import { invalid, record, uuid } from './decoders.ts';
import type { HardwareReadScope } from './contracts.ts';
export interface ReadSupplierInvoice {
    id: string;
    supplierReference: string | null;
    internalReference: string | null;
    supplier: string | null;
    date: string | null;
    dueDate: string | null;
    postingStatus: string | null;
    matchStatus: string | null;
    procurementMode: string | null;
    currency: string | null;
    total: string | null;
}
export interface SupplierInvoicePage {
    rows: ReadSupplierInvoice[];
    total: number;
    totalPages: number;
    page: number;
    limit: number;
}
function text(value: unknown): string | null {
    if (value === null || value === undefined)
        return null;
    return typeof value === 'string' ? value : invalid();
}
function date(value: unknown): string | null {
    const v = text(value);
    if (v === null)
        return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v))
        return invalid();
    const parsed = new Date(v + 'T00:00:00Z');
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== v)
        return invalid();
    return v;
}
function amount(value: unknown): string | null {
    if (value === null)
        return null;
    if (typeof value === 'string' && /^-?\d{1,30}(?:\.\d{1,20})?$/.test(value))
        return value;
    if (typeof value === 'number' && Number.isFinite(value))
        return String(value);
    return invalid();
}
/** Minimal register projection from the existing paged supplier-invoices list. No matching/posting. */
export function decodeSupplierInvoicePage(value: unknown, scope: HardwareReadScope, expectedPage = 1): SupplierInvoicePage {
    const body = record(value), p = record(body.pagination);
    if (!uuid(scope.organizationId) || !uuid(scope.storeId) || !Number.isSafeInteger(expectedPage) || expectedPage < 1 || body.success !== true || body.error || body.demoFallback || !Array.isArray(body.data) || p.page !== expectedPage || p.limit !== 10 || !Number.isSafeInteger(p.total) || (p.total as number) < 0 || p.totalPages !== Math.ceil((p.total as number) / 10))
        return invalid();
    const total = p.total as number;
    if (body.data.length !== Math.max(0, Math.min(total - (expectedPage - 1) * 10, 10)))
        return invalid();
    const seen = new Set<string>();
    const rows = body.data.map((v): ReadSupplierInvoice => {
        const r = record(v);
        if (!uuid(r.id) || seen.has(r.id) || r.organization_id !== scope.organizationId || r.store_id !== scope.storeId)
            return invalid();
        seen.add(r.id);
        let supplier: string | null = null;
        if (r.suppliers !== null) {
            const s = record(r.suppliers);
            if (!uuid(s.id) || s.id !== r.supplier_id)
                return invalid();
            supplier = text(s.company_name);
        }
        const currency = text(r.currency);
        if (currency !== null && !/^[A-Z]{3}$/.test(currency))
            return invalid();
        return { id: r.id, supplierReference: text(r.supplier_invoice_number), internalReference: text(r.internal_invoice_number), supplier, date: date(r.invoice_date), dueDate: date(r.due_date), postingStatus: text(r.posting_status), matchStatus: text(r.match_status), procurementMode: text(r.procurement_mode), currency, total: amount(r.total_amount) };
    });
    // Existing API reports zero pages for an empty list; keep that metadata intact.
    return { rows, total, totalPages: p.totalPages as number, page: expectedPage, limit: 10 };
}
