import type { StartupContext } from '../integration/contracts.ts';
import { decodeStartup, resolveHardwareScope } from '../integration/decoders.ts';
export type SessionState = {
    status: 'signed-out' | 'loading' | 'profile-missing' | 'inactive' | 'organization-missing' | 'stores-missing' | 'store-required' | 'expired' | 'error';
    message: string;
} | {
    status: 'ready';
    userId: string;
    organizationId: string;
    storeId: string;
    revision: number;
};
/** Provider-neutral lifecycle controller. No SDK, credential storage or default network calls. */
export function createSessionController(load: (signal: AbortSignal) => Promise<unknown>) {
    let revision = 0, request: AbortController | null = null;
    let state: SessionState = { status: 'signed-out', message: 'Sign in to continue.' };
    let startup: StartupContext | null = null;
    function clear(status: 'signed-out' | 'expired') {
        ++revision;
        request?.abort();
        request = null;
        startup = null;
        state = { status, message: status === 'expired' ? 'Your session expired. Sign in again.' : 'Sign in to continue.' };
    }
    return {
        getState: (): SessionState => structuredClone(state),
        signOut: () => clear('signed-out'),
        expire: () => clear('expired'),
        async reconcile(userId: string, selectedStore?: string) {
            const attempt = ++revision;
            request?.abort();
            const controller = new AbortController();
            request = controller;
            startup = null;
            state = { status: 'loading', message: 'Loading authorized workspace…' };
            try {
                const context = decodeStartup(await load(controller.signal), userId);
                if (attempt !== revision || controller.signal.aborted)
                    return;
                if (!context.profile) {
                    state = { status: 'profile-missing', message: 'Your account does not have a profile yet.' };
                    return;
                }
                if (!context.profile.is_active) {
                    state = { status: 'inactive', message: 'Your account is inactive. Contact your administrator.' };
                    return;
                }
                if (!context.organization) {
                    state = { status: 'organization-missing', message: 'Your account is not assigned to a company.' };
                    return;
                }
                const stores = context.stores.filter(store => store.business_type === 'hardware');
                if (!stores.length) {
                    state = { status: 'stores-missing', message: 'No authorized Hardware store is available.' };
                    return;
                }
                startup = context;
                if (!selectedStore) {
                    state = { status: 'store-required', message: 'Select an authorized Hardware store.' };
                    return;
                }
                const scope = resolveHardwareScope(context, selectedStore, revision);
                state = { status: 'ready', ...scope };
            }
            catch {
                if (attempt !== revision || controller.signal.aborted)
                    return;
                startup = null;
                state = { status: 'error', message: 'The authorized workspace could not be verified. Try again.' };
            }
        },
        selectStore(storeId: string) {
            if (!startup)
                throw new Error('An active startup context is required.');
            const scope = resolveHardwareScope(startup, storeId, ++revision);
            state = { status: 'ready', ...scope };
        },
    };
}
