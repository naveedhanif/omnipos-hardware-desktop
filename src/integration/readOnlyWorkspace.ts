import { recordSaveRoutes, type RecordSaveFields, type RecordSaveKind, type RecordSaveResult } from './desktopRecordSave.ts';
import { createHardwareReadAdapter } from './hardwareReadAdapter.ts';
import { resolveHardwareScope, uuid } from './decoders.ts';
import { HardwareReadError, type ReadIdentity, type StartupContext, type BackendStore } from './contracts.ts';
import type { CheckPorts, CheckSession } from './connectionCheck.ts';
import { readWindow, type ReadWindow } from './readWindow.ts';
import { directoryRoutes, type HardwareDirectory } from './hardwareDirectories.ts';
import type { ReadResult } from './readResult.ts';
export type LiveView = ReadResult['kind'];
export const workspaceLifetimeMs = 15 * 60000;
export interface WorkspaceSummary {
    company: string;
    stores: BackendStore[];
    storeId: string | null;
    canReadInvoices: boolean;
    canReadPurchasing: boolean;
    expiresAt: number;
}
/** Memory-only workspace with manual operations. Record saves require an explicit transport. */
export function createReadOnlyWorkspace(ports: CheckPorts, writeFetch?: typeof fetch) {
    const now = ports.now ?? Date.now;
    let revision = 0, session: CheckSession | null = null, startup: StartupContext | null = null, identity: ReadIdentity | null = null;
    let request: AbortController | null = null, busy = false;
    const adapter = createHardwareReadAdapter({ enabled: true, getIdentity: () => identity, getSession: async () => session && session.expiresAt > now() ? session : null, transport: ports.transport });
    function clear() { ++revision; request?.abort(); request = null; session = null; startup = null; identity = null; busy = false; }
    function active() {
        if (!session || session.expiresAt <= now()) {
            clear();
            throw new Error('The read-only session ended. Sign in again.');
        }
    }
    function current(attempt: number) {
        if (attempt !== revision)
            throw new Error('The workspace changed while reading.');
        active();
    }
    function validateContext(context: StartupContext) {
        if (!context.profile?.is_active || !context.organization || !context.stores.some(s => s.business_type === 'hardware'))
            throw new Error('An active account with an existing Hardware store is required.');
    }
    function summary(): WorkspaceSummary | null {
        if (!session)
            return null;
        if (session.expiresAt <= now()) {
            clear();
            return null;
        }
        if (!startup?.organization)
            return null;
        return structuredClone({ company: startup.organization.name, stores: startup.stores.filter(s => s.business_type === 'hardware'), storeId: identity?.storeId ?? null, canReadPurchasing: ['owner', 'admin'].includes(startup.profile!.role.toLowerCase()), canReadInvoices: ['owner', 'admin'].includes(startup.profile!.role.toLowerCase()), expiresAt: session.expiresAt });
    }
    async function readScoped<T>(load: (storeId: string, fresh: StartupContext, signal: AbortSignal) => Promise<T>): Promise<T> {
        active();
        if (busy) throw new Error('Wait for the current read to finish.');
        if (!startup?.organization || !identity?.storeId) throw new Error('Select an authorized Hardware store first.');
        const attempt = revision, storeId = identity.storeId, organizationId = identity.organizationId;
        request = new AbortController();
        busy = true;
        try {
            // Revalidate active membership, company, store and role before EVERY manual data read.
            const fresh = await adapter.getStartupContext({ signal: request.signal });
            current(attempt);
            validateContext(fresh);
            if (fresh.organization?.id !== organizationId)
                throw new HardwareReadError('scope-mismatch', 'The authorized company changed. Sign in again.');
            resolveHardwareScope(fresh, storeId, revision);
            startup = fresh;
            const value = await load(storeId, fresh, request.signal);
            current(attempt);
            return value;
        }
        catch (error) {
            if (attempt === revision)
                clear();
            throw error;
        }
        finally {
            if (attempt === revision)
                busy = false;
        }
    }
    return {
        clear, summary,
        async saveRecord(kind: RecordSaveKind, fields: RecordSaveFields): Promise<RecordSaveResult> {
            const state = summary();
            const storeId = identity?.storeId;
            if (!writeFetch || busy || !storeId || !state?.canReadPurchasing)
                return { status: 'refused' };
            const attempt = revision;
            const token = session!.accessToken;
            busy = true;
            try {
                const response = await writeFetch(recordSaveRoutes[kind], {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
                    body: JSON.stringify({ ...fields, storeId }), credentials: 'omit', redirect: 'error', cache: 'no-store',
                    signal: AbortSignal.timeout(50000),
                });
                current(attempt);
                const data = await response.json();
                current(attempt);
                if (response.ok && data?.code === 'SAVED' && uuid(data.id) && (!fields.id || data.id === fields.id))
                    return { status: 'saved', id: data.id };
                if (response.status === 409 && data?.code === 'SAVE_CONFLICT')
                    return { status: 'conflict' };
                if (data?.code === 'SAVE_REFUSED' || data?.code === 'SESSION_REQUIRED')
                    return { status: 'refused' };
                return { status: 'uncertain' };
            } catch {
                return { status: 'uncertain' };
            } finally {
                if (attempt === revision)
                    busy = false;
            }
        },
        getSaleReceipt(saleId: string) {
            return readScoped(async (storeId, fresh, signal) => {
                if (!['owner', 'admin'].includes(fresh.profile!.role.toLowerCase()))
                    throw new HardwareReadError('forbidden', 'Owner/admin access is required for sale receipts.');
                try {
                    return await adapter.getHardwareSaleReceipt(storeId, saleId, signal);
                } catch (error) {
                    if (error instanceof HardwareReadError && error.status === 404)
                        return null;
                    throw error;
                }
            });
        },
        checkActiveTill() {
            return readScoped((storeId, _fresh, signal) => adapter.getActiveTill(storeId, signal));
        },
        async signIn(email: string, password: string, consent: boolean) {
            clear();
            if (!consent || !email.trim() || !password)
                throw new Error('Approve read-only browsing and enter your existing account credentials.');
            const attempt = revision;
            request = new AbortController();
            busy = true;
            try {
                const value = await ports.signIn(email.trim(), password, request.signal);
                if (attempt !== revision)
                    throw new Error('The workspace check ended.');
                if (!uuid(value.userId) || typeof value.accessToken !== 'string' || !value.accessToken || /\s/.test(value.accessToken) || !Number.isFinite(value.expiresAt) || value.expiresAt <= now())
                    throw new Error('A valid session was not returned.');
                session = { ...value, expiresAt: Math.min(value.expiresAt, now() + workspaceLifetimeMs) };
                identity = { userId: session.userId, revision };
                ports.onAuthenticated?.();
                const context = await adapter.getStartupContext({ signal: request.signal });
                current(attempt);
                validateContext(context);
                startup = context;
                identity = { ...identity, organizationId: context.organization!.id };
                return summary()!;
            }
            catch (error) {
                if (attempt === revision)
                    clear();
                throw error;
            }
            finally {
                if (attempt === revision)
                    busy = false;
            }
        },
        selectStore(storeId: string | null) {
            active();
            if (!startup)
                throw new Error('Sign in before selecting a store.');
            const selected: ReadIdentity = storeId === null ? { userId: session!.userId, organizationId: startup.organization!.id, revision: revision + 1 } : resolveHardwareScope(startup, storeId, revision + 1);
            ++revision;
            request?.abort();
            request = null;
            busy = false;
            identity = selected;
            return summary()!;
        },
        async read(view: LiveView, window: ReadWindow = {}): Promise<ReadResult> {
            active();
            if (busy)
                throw new Error('Wait for the current read to finish.');
            if (!startup?.organization || !identity?.storeId)
                throw new Error('Select an authorized Hardware store first.');
            if (!['products', 'inventory', 'invoices', 'receipts', 'supplierInvoices', 'supplierReturns', 'rateDifferences', ...Object.keys(directoryRoutes)].includes(view))
                throw new Error('Choose a supported read-only view.');
            const q = readWindow(window);
            if (view === 'rateDifferences' && q.search)
                throw new HardwareReadError('not-ready', 'Rate differences support invoice pages only.');
            return readScoped(async (storeId, fresh, signal) => {
                if (['invoices', 'receipts', 'supplierInvoices', 'supplierReturns', 'rateDifferences', 'suppliers', 'purchaseOrders'].includes(view) && !['owner', 'admin'].includes(fresh.profile!.role.toLowerCase()))
                    throw new HardwareReadError('forbidden', 'Owner/admin access is required for this view.');
                let result: ReadResult;
                if (view === 'categories' || view === 'suppliers' || view === 'purchaseOrders')
                    result = { kind: view, data: await adapter.getHardwareDirectory(view, storeId, { ...q, signal }) } as Extract<ReadResult, { kind: HardwareDirectory }>;
                else if (view === 'products')
                    result = { kind: 'products', data: await adapter.getHardwareProducts(storeId, { page: q.page, limit: 10, search: q.search }, { signal: signal }) };
                else if (view === 'invoices')
                    result = { kind: 'invoices', data: await adapter.getHardwareInvoices(storeId, { ...q, signal: signal }) };
                else if (view === 'receipts')
                    result = { kind: 'receipts', data: await adapter.getHardwareGoodsReceipts(storeId, { ...q, signal: signal }) };
                else if (view === 'rateDifferences') {
                    const data = await adapter.getHardwareRateDifferences(storeId, { ...q, signal: signal });
                    if (data.rows.some(r => r.currency !== fresh.stores.find(s => s.id === storeId)?.currency))
                        throw new HardwareReadError('scope-mismatch', 'Report currency does not match the selected store.');
                    result = { kind: 'rateDifferences', data };
                }
                else if (view === 'supplierReturns') {
                    const data = await adapter.getHardwareSupplierReturns(storeId, { ...q, signal: signal });
                    if (data.rows.some(r => r.currency !== fresh.stores.find(s => s.id === storeId)?.currency))
                        throw new HardwareReadError('scope-mismatch', 'Supplier return currency does not match the selected store.');
                    result = { kind: 'supplierReturns', data };
                }
                else if (view === 'supplierInvoices') {
                    const data = await adapter.getHardwareSupplierInvoices(storeId, { ...q, signal: signal });
                    const currency = fresh.stores.find(s => s.id === storeId)?.currency;
                    if (data.rows.some(r => r.currency !== null && r.currency !== currency))
                        throw new HardwareReadError('scope-mismatch', 'Supplier invoice currency does not match the selected store.');
                    result = { kind: 'supplierInvoices', data };
                }
                else {
                    const data = await adapter.getHardwareInventoryBalances(storeId, { ...q, signal: signal });
                    if (data.currency !== null && data.currency !== fresh.stores.find(s => s.id === storeId)?.currency)
                        throw new HardwareReadError('scope-mismatch', 'Inventory currency changed.');
                    result = { kind: 'inventory', data };
                }
                return result;
            });
        },
    };
}
