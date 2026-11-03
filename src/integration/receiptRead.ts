import { invalid, record, uuid } from './decoders.ts';
import type { HardwareReadScope } from './contracts.ts';
export interface ReceiptLine {
    id: string;
    product: string | null;
    sku: string | null;
    delivered: string | null;
    accepted: string | null;
    rejected: string | null;
    damaged: string | null;
    quarantined: string | null;
    unitCost: string | null;
}
export interface ReadReceipt {
    id: string;
    reference: string;
    date: string;
    deliveryReference: string | null;
    supplier: string | null;
    purchaseOrder: string | null;
    location: string | null;
    discrepancy: string;
    inspection: string;
    lines: ReceiptLine[];
}
export interface ReceiptPage {
    available: boolean;
    rows: ReadReceipt[];
    total: number | null;
    totalPages: number | null;
    page: number;
    limit: number;
}
const text = (v: unknown): string | null => v === null ? null : typeof v === 'string' ? v : invalid();
function decimal(v: unknown): string | null {
    if (v === null)
        return null;
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0)
        return String(v);
    if (typeof v === 'string' && /^\d{1,30}(?:\.\d{1,20})?$/.test(v))
        return v;
    return invalid();
}
function joined(v: unknown, key: string, expectedId: unknown): string | null {
    if (v === null)
        return null;
    const obj = record(v);
    if (!uuid(obj.id) || obj.id !== expectedId)
        return invalid();
    return text(obj[key]);
}
/** Verified list contract: routes/hardware/goodsReceipts.ts. No receiving or posting. */
export function decodeReceiptPage(value: unknown, scope: HardwareReadScope, expectedPage = 1): ReceiptPage {
    const body = record(value);
    if (!uuid(scope.organizationId) || !uuid(scope.storeId) || !Number.isSafeInteger(expectedPage) || expectedPage < 1 || body.success !== true || body.error || body.demoFallback || typeof body.grnAvailable !== 'boolean' || !Array.isArray(body.data) || body.page !== expectedPage || body.limit !== 10 || !Number.isSafeInteger(body.total) || (body.total as number) < 0)
        return invalid();
    if (!body.grnAvailable) {
        if (body.data.length || body.total !== 0)
            return invalid();
        return { available: false, rows: [], total: null, totalPages: null, page: expectedPage, limit: 10 };
    }
    const total = body.total as number;
    if (body.data.length !== Math.max(0, Math.min(total - (expectedPage - 1) * 10, 10)))
        return invalid();
    const ids = new Set<string>(), lineIds = new Set<string>();
    const rows = body.data.map((v): ReadReceipt => {
        const r = record(v);
        if (!uuid(r.id) || ids.has(r.id) || r.organization_id !== scope.organizationId || r.store_id !== scope.storeId || typeof r.grn_number !== 'string' || !r.grn_number || typeof r.received_at !== 'string' || !Number.isFinite(Date.parse(r.received_at)) || typeof r.discrepancy_status !== 'string' || !['none', 'partial_discrepancy', 'full_rejection'].includes(r.discrepancy_status) || typeof r.inspection_status !== 'string' || !['passed', 'pending_inspection', 'failed'].includes(r.inspection_status) || !Array.isArray(r.goods_receipt_lines) || r.goods_receipt_lines.length > 200)
            return invalid();
        ids.add(r.id);
        const lines = r.goods_receipt_lines.map((v): ReceiptLine => {
            const l = record(v);
            if (!uuid(l.id) || lineIds.has(l.id) || !uuid(l.product_id) || (l.goods_receipt_id !== undefined && l.goods_receipt_id !== r.id) || (l.store_id !== undefined && l.store_id !== scope.storeId) || (l.organization_id !== undefined && l.organization_id !== scope.organizationId))
                return invalid();
            lineIds.add(l.id);
            return { id: l.id, product: joined(l.products, 'name', l.product_id), sku: l.products === null ? null : text(record(l.products).sku), delivered: decimal(l.delivered_qty), accepted: decimal(l.accepted_qty), rejected: decimal(l.rejected_qty), damaged: decimal(l.damaged_qty), quarantined: decimal(l.quarantined_qty), unitCost: decimal(l.unit_cost) };
        });
        return { id: r.id, reference: r.grn_number, date: r.received_at, deliveryReference: text(r.supplier_delivery_reference), supplier: joined(r.suppliers, 'company_name', r.supplier_id), purchaseOrder: joined(r.purchase_orders, 'po_number', r.purchase_order_id), location: joined(r.inventory_locations, 'name', r.inventory_location_id), discrepancy: r.discrepancy_status as string, inspection: r.inspection_status as string, lines };
    });
    return { available: true, rows, total, totalPages: Math.max(1, Math.ceil(total / 10)), page: expectedPage, limit: 10 };
}
