import { invalid, record, uuid } from './decoders.ts';
import type { HardwareReadScope } from './contracts.ts';
export const returnStatusLabels = {
    draft: 'Draft',
    pending_approval: 'Submitted — awaiting posting',
    posted_credit_pending: 'Posted — credit pending',
    closed: 'Closed',
    reversed: 'Reversed',
} as const;
export type ReturnStatus = keyof typeof returnStatusLabels;
export interface ReadSupplierReturn {
    id: string;
    reference: string;
    status: ReturnStatus;
    sourceKind: 'po_grn' | 'direct_purchase_receipt';
    sourceReference: string | null;
    supplier: string | null;
    currency: string;
    createdAt: string;
    postedAt: string | null;
}
export interface SupplierReturnPage {
    rows: ReadSupplierReturn[];
    total: number;
    totalPages: number;
    page: number;
    limit: number;
}
function text(v: unknown): string | null {
    return v === null ? null : typeof v === 'string' ? v : invalid();
}
function timestamp(v: unknown): string | null {
    const s = text(v);
    if (s !== null && !Number.isFinite(Date.parse(s)))
        return invalid();
    return s;
}
/** Verified minimal register. Response omits scope IDs; scope is bound by request/startup/backend. */
export function decodeSupplierReturnPage(value: unknown, scope: HardwareReadScope, expectedPage = 1): SupplierReturnPage {
    const b = record(value), p = record(b.pagination);
    if (!uuid(scope.organizationId) || !uuid(scope.storeId) || !Number.isSafeInteger(expectedPage) || expectedPage < 1 || b.success !== true || b.error || b.demoFallback || !Array.isArray(b.data) || typeof b.draftActionsEnabled !== 'boolean' || typeof b.postingEnabled !== 'boolean' || p.page !== expectedPage || p.limit !== 10 || !Number.isSafeInteger(p.total) || (p.total as number) < 0 || p.totalPages !== Math.max(1, Math.ceil((p.total as number) / 10)))
        return invalid();
    const total = p.total as number;
    if (b.data.length !== Math.max(0, Math.min(total - (expectedPage - 1) * 10, 10)))
        return invalid();
    const seen = new Set<string>();
    const rows = b.data.map((v): ReadSupplierReturn => {
        const r = record(v);
        if (!uuid(r.id) || seen.has(r.id) || typeof r.returnNumber !== 'string' || !r.returnNumber || typeof r.status !== 'string' || !Object.hasOwn(returnStatusLabels, r.status) || (r.sourceKind !== 'po_grn' && r.sourceKind !== 'direct_purchase_receipt') || typeof r.currency !== 'string' || !/^[A-Z]{3}$/.test(r.currency))
            return invalid();
        if ((r.organization_id !== undefined && r.organization_id !== scope.organizationId) || (r.store_id !== undefined && r.store_id !== scope.storeId))
            return invalid();
        seen.add(r.id);
        let supplier: string | null = null, sourceReference: string | null = null;
        if (r.supplier !== null) {
            const s = record(r.supplier);
            if (!uuid(s.id))
                return invalid();
            supplier = text(s.name);
        }
        if (r.sourceReference !== null) {
            const s = record(r.sourceReference);
            if (!uuid(s.id) || s.kind !== r.sourceKind)
                return invalid();
            // The source contract returns no display label for direct receipts. Do not invent one.
            if (s.kind === 'direct_purchase_receipt' && s.label !== null)
                return invalid();
            sourceReference = text(s.label);
        }
        const createdAt = timestamp(r.createdAt);
        if (createdAt === null)
            return invalid();
        return { id: r.id, reference: r.returnNumber, status: r.status as ReturnStatus, sourceKind: r.sourceKind as ReadSupplierReturn['sourceKind'], sourceReference, supplier, currency: r.currency, createdAt, postedAt: timestamp(r.postedAt) };
    });
    // Feature flags intentionally do not leave the decoder or grant UI write authority.
    return { rows, total, totalPages: p.totalPages as number, page: expectedPage, limit: 10 };
}
