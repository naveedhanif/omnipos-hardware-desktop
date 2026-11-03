import { invalid, record, uuid } from './decoders.ts';
export interface ReadInvoice {
    id: string;
    reference: string | null;
    date: string | null;
    status: string | null;
    tender: string | null;
    subtotal: string | null;
    tax: string | null;
    total: string | null;
}
export interface InvoicePage {
    rows: ReadInvoice[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
const text = (v: unknown): string | null => v === null ? null : typeof v === 'string' ? v : invalid();
function amount(v: unknown): string | null {
    if (v === null)
        return null;
    if (typeof v === 'number' && Number.isFinite(v))
        return String(v);
    if (typeof v === 'string' && /^-?\d{1,30}(?:\.\d{1,20})?$/.test(v))
        return v;
    return invalid();
}
/** Read-only subset from routes/hardware/sales.ts:583-863. Scope IDs are not in this response. */
export function decodeInvoicePage(value: unknown, expectedPage = 1): InvoicePage {
    if (!Number.isSafeInteger(expectedPage) || expectedPage < 1)
        return invalid();
    const body = record(value);
    if (body.error || body.demoFallback || body.success === false || !Array.isArray(body.data) || !Number.isSafeInteger(body.count) || (body.count as number) < 0 || body.page !== expectedPage || body.limit !== 10)
        return invalid();
    const seen = new Set<string>();
    const rows = body.data.map((item): ReadInvoice => {
        const row = record(item);
        if (!uuid(row.id) || seen.has(row.id))
            return invalid();
        seen.add(row.id);
        if (row.status === 'voided')
            return invalid();
        const date = text(row.sale_date);
        if (date !== null && !Number.isFinite(Date.parse(date)))
            return invalid();
        return { id: row.id, reference: text(row.receipt_number), date, status: text(row.status), tender: text(row.tender_type), subtotal: amount(row.subtotal), tax: amount(row.tax_total), total: amount(row.grand_total) };
    });
    const total = body.count as number;
    if (rows.length !== Math.max(0, Math.min(total - (expectedPage - 1) * 10, 10)))
        return invalid();
    return { rows, total, page: expectedPage, limit: 10, totalPages: Math.max(1, Math.ceil(total / 10)) };
}
