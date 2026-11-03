import { createHardwareReadAdapter, type ReadRequest, type ReadResponse } from './hardwareReadAdapter.ts';
import { resolveHardwareScope } from './decoders.ts';
import type { ReadIdentity, ReadProductPage, StartupContext } from './contracts.ts';
export interface CheckSession {
    userId: string;
    accessToken: string;
    expiresAt: number;
}
export interface CheckPorts {
    signIn(email: string, password: string, signal: AbortSignal): Promise<CheckSession>;
    transport(request: ReadRequest): Promise<ReadResponse>;
    now?(): number;
}
/** One explicit sign-in + startup, then one product read per sign-in. No storage or retries. */
export function createConnectionCheck(ports: CheckPorts) {
    let revision = 0, identity: ReadIdentity | null = null, session: CheckSession | null = null;
    let startup: StartupContext | null = null, controller: AbortController | null = null;
    let consumed = false;
    const now = ports.now ?? Date.now;
    const adapter = createHardwareReadAdapter({ enabled: true, getIdentity: () => identity,
        getSession: async () => session && session.expiresAt > now() ? session : null, transport: ports.transport });
    function clear() { ++revision; controller?.abort(); controller = null; identity = null; session = null; startup = null; consumed = false; }
    return {
        clear,
        async signIn(email: string, password: string, consent: boolean) {
            clear();
            if (!consent || !email.trim() || !password)
                throw new Error('Confirm the read-only check and enter your existing account credentials.');
            const attempt = revision;
            controller = new AbortController();
            try {
                const result = await ports.signIn(email.trim(), password, controller.signal);
                if (attempt !== revision)
                    throw new Error('Connection check ended.');
                if (!result.accessToken || result.expiresAt <= now())
                    throw new Error('A valid session was not returned.');
                session = result;
                identity = { userId: result.userId, revision };
                const context = await adapter.getStartupContext({ signal: controller.signal });
                if (context.profile?.is_active !== true || !context.organization || !context.stores.some(s => s.business_type === 'hardware'))
                    throw new Error('An active account with an existing Hardware store is required.');
                startup = context;
                return structuredClone({ organization: context.organization, stores: context.stores.filter(s => s.business_type === 'hardware') });
            }
            catch (error) {
                if (attempt === revision)
                    clear();
                throw error;
            }
        },
        async products(storeId: string): Promise<ReadProductPage> {
            if (!startup || !session || consumed)
                throw new Error('Start a new check before reading products again.');
            identity = resolveHardwareScope(startup, storeId, ++revision);
            const attempt = revision;
            consumed = true;
            try {
                return await adapter.getHardwareProducts(storeId, { page: 1, limit: 10 }, { signal: controller!.signal });
            }
            finally {
                if (attempt === revision)
                    clear();
            }
        },
    };
}
