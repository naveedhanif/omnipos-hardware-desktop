import { invalid, record, uuid } from './decoders.ts';

export interface SaleReceipt {
    id: string;
    storeId: string;
    reference: string | null;
    status: string;
    tender: string;
    total: string;
}

export function decodeSaleReceipt(value: unknown, storeId: string, saleId: string): SaleReceipt {
    const receipt = record(value);
    const { id, reference, status, tender, total } = receipt;
    if (!uuid(id) || id !== saleId || receipt.storeId !== storeId ||
        (reference !== null && (typeof reference !== 'string' || reference.length > 120)) ||
        typeof status !== 'string' || !/^[a-z_]{1,32}$/i.test(status) ||
        typeof tender !== 'string' || !/^[a-z_]{1,32}$/i.test(tender) ||
        typeof total !== 'string' || !/^\d{1,16}(?:\.\d{1,12})?$/.test(total))
        return invalid();
    return { id, storeId, reference, status, tender, total };
}

export function projectSaleReceipt(value: unknown, storeId: string, saleId: string): SaleReceipt {
    const body = record(value);
    if (body.success !== true || body.error || body.demoFallback)
        return invalid();
    const sale = record(body.sale);
    const total = typeof sale.grand_total === 'number' ? String(sale.grand_total) : sale.grand_total;
    return decodeSaleReceipt({
        id: sale.id, storeId: sale.store_id, reference: sale.reference,
        status: sale.status, tender: sale.payment_type, total,
    }, storeId, saleId);
}
