import { HardwareReadError } from './contracts.ts';
import { record, uuid } from './decoders.ts';

export const directoryRoutes = {
    categories: '/api/hardware/categories',
    suppliers: '/api/hardware/suppliers',
    purchaseOrders: '/api/hardware/purchase-orders',
} as const;
export type HardwareDirectory = keyof typeof directoryRoutes;
export type DirectoryRow = { id: string; name: string; status: string };
export interface DirectoryPage {
    page: number;
    total: number;
    totalPages: number;
    rows: DirectoryRow[];
}
export function directoryForPath(path: string) {
    return (Object.keys(directoryRoutes) as HardwareDirectory[]).find(key => directoryRoutes[key] === path);
}
function invalid(): never {
    throw new HardwareReadError('invalid-response', 'The Hardware register returned invalid records.');
}
function label(value: unknown): string {
    if (typeof value !== 'string' || !value.trim() || value.length > 250)
        return invalid();
    return value;
}
/** The existing upstream lists are unpaged. Project a small page before sending anything to the browser. */
export function projectHardwareDirectory(kind: HardwareDirectory, value: unknown, scope: { storeId: string; organizationId: string }, page: number, search: string): DirectoryPage {
    const payload = record(value), items = kind === 'categories' ? payload.categories : payload.data;
    if (payload.error || payload.success !== true || !Array.isArray(items))
        return invalid();
    const ids = new Set<string>();
    const projected = items.map(item => {
        const row = record(item);
        if (!uuid(row.id) || row.store_id !== scope.storeId || ids.has(row.id) ||
            ((kind !== 'purchaseOrders' || row.organization_id !== undefined) && row.organization_id !== scope.organizationId))
            return invalid();
        ids.add(row.id);
        if (kind === 'categories') {
            if (row.is_active !== true)
                return invalid();
            return { id: row.id, name: label(row.name), status: 'Active' };
        }
        if (kind === 'suppliers')
            return { id: row.id, name: label(row.company_name), status: label(row.status) };
        // In particular, do not forward the upstream supplier/contact join or order lines.
        return { id: row.id, name: label(row.po_number), status: label(row.status) };
    });
    const query = search.toLowerCase();
    const rows = projected.filter(row => [row.name, row.status].some(field => field.toLowerCase().includes(query)));
    return { page, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / 10)), rows: rows.slice((page - 1) * 10, page * 10) };
}

export function decodeDirectoryPage(value: unknown, requestedPage: number): DirectoryPage {
    const body = record(value), { page, total, totalPages, rows } = body;
    if (body.error || page !== requestedPage || typeof total !== 'number' || !Number.isSafeInteger(total) || total < 0 ||
        totalPages !== Math.max(1, Math.ceil(total / 10)) || !Array.isArray(rows) ||
        rows.length !== Math.max(0, Math.min(10, total - (requestedPage - 1) * 10)))
        return invalid();
    const ids = new Set<string>();
    return { page: requestedPage, total, totalPages: Math.max(1, Math.ceil(total / 10)), rows: rows.map(item => {
        const row = record(item);
        if (!uuid(row.id) || ids.has(row.id))
            return invalid();
        ids.add(row.id);
        return { id: row.id, name: label(row.name), status: label(row.status) };
    }) };
}
