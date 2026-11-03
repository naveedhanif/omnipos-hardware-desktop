import { HardwareReadError, type HardwareReadScope } from './contracts.ts';
import { invalid, record, uuid } from './decoders.ts';
export interface InventoryBalance {
    id: string;
    productId: string | null;
    name: string;
    sku: string;
    unit: string | null;
    locationId: string | null;
    locationName: string | null;
    bin: string | null;
    quantity: string | null;
    averageCost: string | null;
    value: string | null;
    valuationStatus: 'valued' | 'incomplete';
    valuationIssue: 'quantity_unavailable' | 'cost_unavailable' | 'quantity_and_cost_unavailable' | 'currency_unavailable' | null;
    stockStatus: 'low' | 'out' | 'healthy' | 'unknown';
    stockReason: 'quantity_unavailable' | 'reorder_level_invalid' | null;
}
export interface InventoryPage {
    rows: InventoryBalance[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    currency: string | null;
    fractionDigits: number | null;
}
function decimalText(value: unknown, maxInteger = 30): string | null {
    if (value === null)
        return null;
    if (typeof value !== 'string' || !/^-?\d+(?:\.\d{1,20})?$/.test(value) || value.split('.')[0].replace('-', '').length > maxInteger)
        return invalid();
    return value;
}
const text = (v: unknown): string => typeof v === 'string' ? v : invalid();
const nullableText = (v: unknown): string | null => v === null ? null : text(v);
const nullableId = (v: unknown): string | null => v == null ? null : uuid(v) ? v : invalid();
const integer = (v: unknown, min: number): number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min ? v : invalid();
/** Exact response projection from routes/hardware/inventory.ts:165-293. No arithmetic or float fallback. */
export function decodeInventoryPage(value: unknown, scope: HardwareReadScope, expectedPage = 1): InventoryPage {
    const body = record(value), pagination = record(body.pagination), valuation = record(body.valuation);
    if (body.success !== true || body.error || !Array.isArray(body.data))
        return invalid();
    const currency = nullableText(valuation.currency), fractionDigits = valuation.fractionDigits === null ? null : integer(valuation.fractionDigits, 0);
    if ((currency !== null && !/^[A-Z]{3}$/.test(currency)) || (fractionDigits !== null && fractionDigits > 4) || (currency === null && fractionDigits !== null) || valuation.rounding !== 'per_balance_half_away_from_zero')
        return invalid();
    const ids = new Set<string>();
    const rows = body.data.map((item): InventoryBalance => {
        const row = record(item);
        // Current route omits these IDs after its scoped query. Never invent them as response evidence.
        if ((row.store_id !== undefined && row.store_id !== scope.storeId) || (row.organization_id !== undefined && row.organization_id !== scope.organizationId))
            throw new HardwareReadError('scope-mismatch', 'Inventory response includes an unrelated workspace.');
        if (!uuid(row.id) || ids.has(row.id))
            return invalid();
        ids.add(row.id);
        const quantity = decimalText(row.qty_on_hand_decimal), averageCost = decimalText(row.avg_cost), amount = decimalText(row.stock_value, 60);
        const issue = quantity === null ? averageCost === null ? 'quantity_and_cost_unavailable' : 'quantity_unavailable' : averageCost === null ? 'cost_unavailable' : fractionDigits === null ? 'currency_unavailable' : null;
        if (row.valuation_status !== (issue ? 'incomplete' : 'valued') || row.valuation_issue !== issue || (issue ? amount !== null : amount === null))
            return invalid();
        if (!['low', 'out', 'healthy', 'unknown'].includes(String(row.stock_status)))
            return invalid();
        if (row.stock_status === 'unknown' ? !['quantity_unavailable', 'reorder_level_invalid'].includes(String(row.stock_status_reason)) : row.stock_status_reason !== null)
            return invalid();
        if (quantity === null && (row.stock_status !== 'unknown' || row.stock_status_reason !== 'quantity_unavailable'))
            return invalid();
        if (quantity !== null && row.stock_status_reason === 'quantity_unavailable')
            return invalid();
        if (quantity !== null) {
            const scaled = BigInt(quantity.replace('.', ''));
            if ((scaled <= 0n) !== (row.stock_status === 'out'))
                return invalid();
        }
        return { id: row.id, productId: nullableId(row.product_id), name: text(row.product_name), sku: text(row.sku), unit: nullableText(row.uom),
            locationId: nullableId(row.location_id), locationName: nullableText(row.location_name), bin: nullableText(row.bin_location),
            quantity, averageCost, value: amount, valuationStatus: row.valuation_status as InventoryBalance['valuationStatus'], valuationIssue: issue,
            stockStatus: row.stock_status as InventoryBalance['stockStatus'], stockReason: row.stock_status_reason as InventoryBalance['stockReason'] };
    });
    const total = integer(pagination.total, 0), page = integer(pagination.page, 1), limit = integer(pagination.limit, 1), totalPages = integer(pagination.totalPages, 1);
    if (page !== expectedPage || limit !== 10 || totalPages !== Math.max(1, Math.ceil(total / limit)) || rows.length !== Math.max(0, Math.min(total - (page - 1) * limit, limit)))
        return invalid();
    return { rows, total, page, limit, totalPages, currency, fractionDigits };
}
