import { uuid } from './decoders.ts';
import type { BackendStore, ReadProduct } from './contracts.ts';

export interface CashCheckoutRequest {
    readonly storeId: string;
    readonly tillSessionId: string;
    readonly idempotencyKey: string;
    readonly paymentType: 'cash';
    readonly cashReceived: string;
    readonly basketItems: readonly [{ readonly productId: string; readonly qty: 1; readonly price: number; readonly name: string }];
}

export type CashCheckoutOutcome =
    | { status: 'posted'; saleId: string; receiptNumber: string | null; grandTotal: number }
    | { status: 'denied' }
    | { status: 'uncertain'; reference: string };

/** Prepare the exact-cash, one-item pilot request from a scoped product and till. */
export function prepareCashCheckout(
    store: BackendStore,
    pilotStoreId: string,
    product: ReadProduct,
    till: { id: string; store_id: string; status: string },
    reference: string,
): CashCheckoutRequest {
    const price = product.sell_price;
    if (!uuid(pilotStoreId) || store.id !== pilotStoreId || store.business_type !== 'hardware' ||
        store.currency !== 'KWD' || product.store_id !== store.id || !uuid(product.id) ||
        !uuid(till.id) || till.store_id !== store.id || till.status !== 'open' || !uuid(reference))
        throw new Error('Cash checkout requires the approved Hardware store, its product and its open till.');
    if (price === null || price <= 0 || !/^\d+(?:\.\d{1,3})?$/.test(String(price)) ||
        !Number.isSafeInteger(Math.round(price * 1000)) ||
        product.stock_qty === null || !Number.isFinite(product.stock_qty) || product.stock_qty < 1)
        throw new Error('Cash checkout requires a valid KWD price and one available unit.');
    const line = Object.freeze({ productId: product.id, qty: 1 as const, price, name: product.name });
    return Object.freeze({
        storeId: store.id, tillSessionId: till.id, idempotencyKey: reference,
        paymentType: 'cash', cashReceived: price.toFixed(3),
        basketItems: Object.freeze([line] as const),
    });
}

/** One submission per attempt. The caller supplies transport after backend verification. */
export function cashCheckoutAttempt(
    request: CashCheckoutRequest,
    post: (request: CashCheckoutRequest) => Promise<{ status: number; body: unknown }>,
) {
    let submission: Promise<CashCheckoutOutcome> | undefined;
    async function submit(): Promise<CashCheckoutOutcome> {
        try {
            const { status, body } = await post(request);
            if (body && typeof body === 'object') {
                const reply = body as Record<string, unknown>;
                if (status === 403 && reply.code === 'HARDWARE_CHECKOUT_FORBIDDEN')
                    return { status: 'denied' };
                if (status === 200 && reply.success === true && reply.demoFallback === false &&
                    reply.paymentType === 'cash' && uuid(reply.saleId) && typeof reply.grandTotal === 'number' &&
                    Number.isFinite(reply.grandTotal) && reply.grandTotal > 0 &&
                    reply.grandTotal === Number(request.cashReceived)) {
                    return {
                        status: 'posted', saleId: reply.saleId,
                        receiptNumber: typeof reply.receiptNumber === 'string' ? reply.receiptNumber : null,
                        grandTotal: reply.grandTotal,
                    };
                }
            }
        } catch {
            // A transport error can follow a committed sale.
        }
        return { status: 'uncertain', reference: request.idempotencyKey };
    }
    return () => submission ??= Promise.resolve().then(submit);
}
