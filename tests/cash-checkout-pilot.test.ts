import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareCashCheckout, cashCheckoutAttempt } from '../src/integration/cashCheckoutPilot.ts';
import { liveCashSaleReview } from '../src/ui/liveCashSaleReview.ts';
const storeId = '11111111-1111-4111-8111-111111111111';
const productId = '22222222-2222-4222-8222-222222222222';
const tillId = '33333333-3333-4333-8333-333333333333';
const reference = '44444444-4444-4444-8444-444444444444';
const store = { id: storeId, name: 'Kuwait', business_type: 'hardware', currency: 'KWD', organization_id: storeId };
const product = { id: productId, store_id: storeId, name: 'Fixture', sku: null, barcode: null, cost_price: null, sell_price: 1.125, stock_qty: 1, uom: null };
const till = { id: tillId, store_id: storeId, status: 'open' };
const prepare = () => prepareCashCheckout(store, storeId, product, till, reference);

test('checkout binds the request to the designated store, till and exact cash', () => {
    assert.equal(prepare().cashReceived, '1.125');
    assert.throws(() => prepareCashCheckout(store, productId, product, till, reference));
    assert.throws(() => prepareCashCheckout(store, storeId, { ...product, store_id: tillId }, till, reference));
    assert.throws(() => prepareCashCheckout(store, storeId, product, { ...till, status: 'closed' }, reference));
    assert.throws(() => prepareCashCheckout(store, storeId, { ...product, sell_price: 1.1234 }, till, reference));
});

test('cash review only offers eligible items and displays three-decimal KWD after selection', () => {
    const items = [{ ...product, sell_price: 1.1 }, { ...product, id: reference, name: 'Fractional fils', sell_price: 1.1234 }];
    const unselected = liveCashSaleReview(store, items, { productId: '', till: null }, false);
    assert.match(unselected, /id="live-check-till" disabled/);
    assert.doesNotMatch(unselected, /Fractional fils/);
    const selected = liveCashSaleReview(store, items, { productId, till: 'open' }, false);
    assert.match(selected, /KWD 1\.100/);
    assert.match(selected, /Open when last checked/);
    assert.doesNotMatch(selected, /id="live-check-till" disabled/);
    assert.equal(liveCashSaleReview({ ...store, currency: 'USD' }, items, { productId, till: null }, false), '');
});

test('an uncertain checkout is submitted only once, including concurrent clicks', async () => {
    let requests = 0;
    const submit = cashCheckoutAttempt(prepare(), async payload => {
        requests++;
        assert.equal(payload.idempotencyKey, reference);
        throw new Error('Timed out after submission');
    });
    const results = await Promise.all([submit(), submit()]);
    assert.deepEqual(results, Array(2).fill({ status: 'uncertain', reference }));
    await submit();
    assert.equal(requests, 1);
});

test('checkout requires a real sale ID and matching authoritative total', async () => {
    const body = { success: true, demoFallback: false, paymentType: 'cash', saleId: reference, receiptNumber: 'FIXTURE', grandTotal: 1.125 };
    const run = (payload: unknown, status = 200) => cashCheckoutAttempt(prepare(), async () => ({ status, body: payload }))();
    assert.deepEqual(await run(body), { status: 'posted', saleId: reference, receiptNumber: 'FIXTURE', grandTotal: 1.125 });
    for (const payload of [{ ...body, demoFallback: true }, { ...body, grandTotal: 1.25 }, { ...body, saleId: null }])
        assert.equal((await run(payload)).status, 'uncertain');
    assert.equal((await run({ code: 'HARDWARE_CHECKOUT_FORBIDDEN' }, 403)).status, 'denied');
    assert.equal((await run({}, 500)).status, 'uncertain');
});
