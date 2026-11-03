import { invalid, record, uuid } from './decoders.ts';
import type { HardwareReadScope } from './contracts.ts';
const classifications = ['quantity_variance', 'price_variance', 'quantity_and_price_variance', 'missing_po_evidence', 'missing_grn_evidence', 'invalid_evidence'];
export interface RateDifference {
    invoiceId: string;
    invoiceNumber: string | null;
    invoiceDate: string | null;
    postingStatus: 'draft' | 'pending_approval';
    currency: string;
    supplierName: string;
    productName: string;
    productSku: string | null;
    poOrderedQty: string | null;
    receivedAcceptedQty: string | null;
    invoicedQty: string | null;
    quantityVariance: string | null;
    poUnitCost: string | null;
    invoicedUnitCost: string | null;
    unitCostVariance: string | null;
    lineTotalVariance: string | null;
    classification: string;
}
export interface RateDifferencePage {
    rows: RateDifference[];
    /** Qualifying invoice count, never flattened variance line count. */
    total: number;
    totalPages: number;
    page: number;
    limit: number;
}
const text = (v: unknown): string | null => v === null ? null : typeof v === 'string' ? v : invalid();
const decimal = (v: unknown): string | null => v === null ? null : typeof v === 'string' && /^-?\d{1,30}(?:\.\d{1,20})?$/.test(v) ? v : invalid();
/** Backend-calculated report, paginated by invoice. No local matching/variance calculation. */
export function decodeRateDifferencePage(value: unknown, scope: HardwareReadScope, expectedPage = 1): RateDifferencePage {
    const b = record(value), data = record(b.data), p = record(data.pagination);
    if (!uuid(scope.organizationId) || !uuid(scope.storeId) || !Number.isSafeInteger(expectedPage) || expectedPage < 1 || b.success !== true || b.error || b.demoFallback || !Array.isArray(data.differences) || data.differences.length > 2000 || p.page !== expectedPage || p.limit !== 10 || !Number.isSafeInteger(p.totalInvoices) || (p.totalInvoices as number) < 0 || p.totalPages !== Math.max(1, Math.ceil((p.totalInvoices as number) / 10)))
        return invalid();
    const invoiceMetadata = new Map<string, string>();
    const rows = data.differences.map((v): RateDifference => {
        const r = record(v);
        if (!uuid(r.invoiceId) || (r.postingStatus !== 'draft' && r.postingStatus !== 'pending_approval') || typeof r.currency !== 'string' || !/^[A-Z]{3}$/.test(r.currency) || typeof r.supplierName !== 'string' || typeof r.productName !== 'string' || typeof r.matchClassification !== 'string' || !classifications.includes(r.matchClassification))
            return invalid();
        if ((r.store_id !== undefined && r.store_id !== scope.storeId) || (r.organization_id !== undefined && r.organization_id !== scope.organizationId))
            return invalid();
        const invoiceNumber = text(r.invoiceNumber), invoiceDate = text(r.invoiceDate);
        if (invoiceDate !== null) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate))
                return invalid();
            const date = new Date(invoiceDate + 'T00:00:00Z');
            if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== invoiceDate)
                return invalid();
        }
        const metadata = JSON.stringify([invoiceNumber, invoiceDate, r.postingStatus, r.currency, r.supplierName]);
        if (invoiceMetadata.has(r.invoiceId) && invoiceMetadata.get(r.invoiceId) !== metadata)
            return invalid();
        invoiceMetadata.set(r.invoiceId, metadata);
        const fields = ['poOrderedQty', 'receivedAcceptedQty', 'invoicedQty', 'quantityVariance', 'poUnitCost', 'invoicedUnitCost', 'unitCostVariance', 'lineTotalVariance'] as const;
        const values = Object.fromEntries(fields.map(key => [key, decimal(r[key])])) as Pick<RateDifference, typeof fields[number]>;
        const incomplete = ['missing_po_evidence', 'missing_grn_evidence', 'invalid_evidence'].includes(r.matchClassification);
        if (fields.some(key => incomplete ? values[key] !== null : values[key] === null))
            return invalid();
        return { invoiceId: r.invoiceId, invoiceNumber, invoiceDate, postingStatus: r.postingStatus, currency: r.currency, supplierName: r.supplierName, productName: r.productName, productSku: text(r.productSku), ...values, classification: r.matchClassification };
    });
    // Some qualifying invoices (e.g. direct purchase) yield no report lines. Never require ten lines.
    const invoiceWindow = Math.max(0, Math.min((p.totalInvoices as number) - (expectedPage - 1) * 10, 10));
    if (invoiceMetadata.size > invoiceWindow)
        return invalid();
    return { rows, total: p.totalInvoices as number, totalPages: p.totalPages as number, page: expectedPage, limit: 10 };
}
