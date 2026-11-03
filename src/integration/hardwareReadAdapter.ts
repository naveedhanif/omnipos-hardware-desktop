import { projectReadCode, projectReadReference } from './safeReadDiagnostics.ts';
import { decodeRateDifferencePage } from './rateDifferenceRead.ts';
import { decodeSupplierReturnPage } from './supplierReturnRead.ts';
import { decodeSupplierInvoicePage } from './supplierInvoiceRead.ts';
import { decodeReceiptPage } from './receiptRead.ts';
import { HardwareReadError, type ReadIdentity, type HardwareReadScope, type ProductReadQuery } from './contracts.ts';
import { decodeInventoryPage } from './inventoryRead.ts';
import { decodeInvoicePage } from './invoiceRead.ts';
import { readWindow, type ReadWindow } from './readWindow.ts';
import { uuid, record, decodeStartup, decodeProductPage, decodeReceivingCapabilities, decodeStoreCapabilities } from './decoders.ts';
export interface ReadRequest {
    method: 'GET';
    url: string;
    headers: Readonly<Record<string, string>>;
    signal?: AbortSignal;
}
export interface ReadResponse {
    status: number;
    body: string;
}
export interface ReadAdapterPorts {
    /** Defaults to false. No UI path supplies true or a real transport in Phase 2. */
    enabled?: boolean;
    getIdentity(): ReadIdentity | null;
    getSession(): Promise<{
        userId: string;
        accessToken: string;
    } | null>;
    transport(request: ReadRequest): Promise<ReadResponse>;
}
function identityKey(identity: ReadIdentity): string {
    if (!uuid(identity.userId) || !Number.isSafeInteger(identity.revision) || identity.revision < 0 ||
        [identity.organizationId, identity.storeId, identity.staffId].some(id => id !== undefined && !uuid(id)))
        throw new HardwareReadError('not-ready', 'A reviewed authenticated identity is required.');
    return JSON.stringify([identity.userId, identity.organizationId, identity.storeId, identity.staffId, identity.revision]);
}
function scoped(identity: ReadIdentity, storeId: string): HardwareReadScope {
    if (!identity.organizationId || !identity.storeId || identity.storeId !== storeId)
        throw new HardwareReadError('scope-mismatch', 'Requested store does not match the current workspace.');
    return identity as HardwareReadScope;
}
export function createHardwareReadAdapter(ports: ReadAdapterPorts) {
    function capture(): ReadIdentity {
        if (ports.enabled !== true)
            throw new HardwareReadError('disabled', 'Live Hardware integration is disabled.');
        const value = ports.getIdentity();
        if (!value)
            throw new HardwareReadError('unauthenticated', 'Sign in before reading Hardware data.');
        const identity = Object.freeze({ ...value });
        identityKey(identity);
        return identity;
    }
    function ensureCurrent(identity: ReadIdentity) {
        if (ports.enabled !== true)
            throw new HardwareReadError('disabled', 'Live Hardware integration is disabled.');
        const current = ports.getIdentity();
        if (!current || identityKey(current) !== identityKey(identity))
            throw new HardwareReadError('identity-changed', 'Workspace changed while reading Hardware data.');
    }
    async function read(path: string, identity: ReadIdentity, signal?: AbortSignal): Promise<unknown> {
        signal?.throwIfAborted();
        ensureCurrent(identity);
        let session: Awaited<ReturnType<ReadAdapterPorts['getSession']>>;
        try {
            session = await ports.getSession();
        }
        catch {
            signal?.throwIfAborted();
            ensureCurrent(identity);
            throw new HardwareReadError('unauthenticated', 'The active session could not be verified.');
        }
        signal?.throwIfAborted();
        ensureCurrent(identity);
        if (!session || session.userId !== identity.userId || !session.accessToken || /\s/.test(session.accessToken))
            throw new HardwareReadError('unauthenticated', 'A matching active session is required.');
        let response: ReadResponse;
        try {
            response = await ports.transport({ method: 'GET', url: path, headers: { Authorization: `Bearer ${session.accessToken}` }, signal });
        }
        catch {
            signal?.throwIfAborted();
            ensureCurrent(identity);
            throw new HardwareReadError('network', 'The Hardware read could not be confirmed.');
        }
        signal?.throwIfAborted();
        ensureCurrent(identity);
        if (!Number.isInteger(response.status) || response.status < 100 || response.status > 599)
            throw new HardwareReadError('invalid-response', 'Hardware returned an invalid HTTP status.');
        let body: unknown;
        try {
            body = JSON.parse(response.body);
        }
        catch {
            throw new HardwareReadError('invalid-response', 'Hardware returned an unreadable response.', response.status);
        }
        if (response.status < 200 || response.status >= 300) {
            const data = body && typeof body === 'object' && !Array.isArray(body) ? record(body) : {};
            throw new HardwareReadError(response.status === 401 ? 'unauthenticated' : response.status === 403 ? 'forbidden' : 'http', 'Hardware refused or could not complete this read.', response.status, projectReadCode(data.code), projectReadReference(data.correlationId));
        }
        return body;
    }
    return {
        async getStartupContext(options?: {
            signal?: AbortSignal;
        }) {
            const identity = capture();
            return decodeStartup(await read('/api/startup-context', identity, options?.signal), identity.userId);
        },
        async getHardwareProducts(storeId: string, params: ProductReadQuery = {}, options?: {
            signal?: AbortSignal;
        }) {
            const identity = capture(), scope = scoped(identity, storeId);
            const page = params.page ?? 1, limit = params.limit ?? 50;
            if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100)
                throw new HardwareReadError('not-ready', 'Use positive page and limit values (maximum 100 per read).');
            const query = new URLSearchParams({ storeId, page: String(page), limit: String(limit) });
            for (const key of ['search', 'categoryId', 'supplierId', 'stockStatus', 'priceStatus', 'costStatus', 'skuStatus', 'activeStatus'] as const)
                if (params[key])
                    query.set(key, params[key]!);
            const result = decodeProductPage(await read(`/api/hardware/products?${query}`, identity, options?.signal), scope);
            if (result.page !== page || result.limit !== limit)
                throw new HardwareReadError('invalid-response', 'Hardware pagination did not match this request.');
            return result;
        },
        async getHardwareCapabilities(storeId: string, options?: {
            signal?: AbortSignal;
        }) {
            const identity = capture();
            scoped(identity, storeId);
            return decodeReceivingCapabilities(await read(`/api/hardware/capabilities?${new URLSearchParams({ storeId })}`, identity, options?.signal));
        },
        async getHardwareInventoryBalances(storeId: string, options?: ReadWindow & {
            signal?: AbortSignal;
        }) {
            const identity = capture(), scope = scoped(identity, storeId);
            const q = readWindow(options), query = new URLSearchParams({ storeId, page: String(q.page), limit: '10' });
            if (q.search)
                query.set('search', q.search);
            return decodeInventoryPage(await read(`/api/hardware/inventory/balances?${query}`, identity, options?.signal), scope, q.page);
        },
        async getHardwareInvoices(storeId: string, options?: ReadWindow & {
            signal?: AbortSignal;
        }) {
            const identity = capture();
            scoped(identity, storeId);
            const q = readWindow(options), query = new URLSearchParams({ storeId, page: String(q.page), limit: '10' });
            if (q.search)
                query.set('search', q.search);
            return decodeInvoicePage(await read(`/api/hardware/sales/invoices?${query}`, identity, options?.signal), q.page);
        },
        async getHardwareGoodsReceipts(storeId: string, options?: ReadWindow & {
            signal?: AbortSignal;
        }) {
            const identity = capture(), scope = scoped(identity, storeId);
            const q = readWindow(options), query = new URLSearchParams({ storeId, page: String(q.page), limit: '10' });
            if (q.search)
                query.set('search', q.search);
            return decodeReceiptPage(await read(`/api/hardware/goods-receipts?${query}`, identity, options?.signal), scope, q.page);
        },
        async getHardwareSupplierInvoices(storeId: string, options?: ReadWindow & {
            signal?: AbortSignal;
        }) {
            const identity = capture(), scope = scoped(identity, storeId);
            const q = readWindow(options), query = new URLSearchParams({ storeId, page: String(q.page), limit: '10' });
            if (q.search)
                query.set('search', q.search);
            return decodeSupplierInvoicePage(await read(`/api/hardware/supplier-invoices?${query}`, identity, options?.signal), scope, q.page);
        },
        async getHardwareSupplierReturns(storeId: string, options?: ReadWindow & {
            signal?: AbortSignal;
        }) {
            const identity = capture(), scope = scoped(identity, storeId);
            const q = readWindow(options), query = new URLSearchParams({ storeId, page: String(q.page), limit: '10' });
            if (q.search)
                query.set('search', q.search);
            return decodeSupplierReturnPage(await read(`/api/hardware/supplier-returns?${query}`, identity, options?.signal), scope, q.page);
        },
        async getHardwareRateDifferences(storeId: string, options?: ReadWindow & {
            signal?: AbortSignal;
        }) {
            const identity = capture(), scope = scoped(identity, storeId), q = readWindow(options);
            if (q.search)
                throw new HardwareReadError('not-ready', 'Rate differences support invoice pages only.');
            const query = new URLSearchParams({ storeId, page: String(q.page), limit: '10' });
            return decodeRateDifferencePage(await read(`/api/hardware/supplier-invoices/reports/rate-differences?${query}`, identity, options?.signal), scope, q.page);
        },
        async getHardwareStoreCapabilities(storeId: string, options?: {
            signal?: AbortSignal;
        }) {
            const identity = capture(), scope = scoped(identity, storeId);
            return decodeStoreCapabilities(await read(`/api/hardware/store-capabilities?${new URLSearchParams({ storeId })}`, identity, options?.signal), scope);
        },
    };
}
