import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveDesktopRecord } from '../server/desktopRecordSave.ts';
import { hardwareTargets } from '../src/integration/connectionConfig.ts';

const userId = '11111111-1111-4111-8111-111111111111';
const organizationId = '22222222-2222-4222-8222-222222222222';
const storeId = '33333333-3333-4333-8333-333333333333';
const id = '44444444-4444-4444-8444-444444444444';
const headers = { authorization: 'Bearer fixture-token', apiOrigin: hardwareTargets.apiOrigin, origin: hardwareTargets.frontendOrigin };
const savedRow = { id, store_id: storeId, organization_id: organizationId };

function fixture(role = 'owner', reply = Response.json({ success: true, product: savedRow }), active = true) {
    const calls: { path: string; method: string; body?: unknown }[] = [];
    const fetcher: typeof fetch = async (url, init) => {
        const path = new URL(String(url)).pathname;
        calls.push({ path, method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
        if (path === '/api/startup-context')
            return Response.json({
                user: { id: userId }, profile: { id: userId, organization_id: organizationId, role, is_active: active },
                organization: { id: organizationId, name: 'Fixture' },
                stores: [{ id: storeId, organization_id: organizationId, name: 'Kuwait', business_type: 'hardware', currency: 'KWD' }],
            });
        return reply;
    };
    return { calls, fetcher };
}

test('catalogue saves use only scoped fields and confirm the returned record identity', async () => {
    const f = fixture();
    const result = await saveDesktopRecord('product', {
        ...headers, body: { id, storeId, name: ' Clamp ', sku: 'SKU', barcode: '', cost: '1.125', price: '2.500', stock_qty: 100 },
    }, f.fetcher);
    assert.equal(result.status, 200);
    assert.deepEqual(JSON.parse(result.body), { code: 'SAVED', id });
    assert.deepEqual(f.calls, [
        { path: '/api/startup-context', method: 'GET', body: undefined },
        { path: '/api/hardware/products/' + id, method: 'PUT', body: { storeId, name: 'Clamp', sku: 'SKU', barcode: null, cost_price: '1.125', sell_price: '2.500' } },
    ]);
    for (const kind of ['category', 'supplier'] as const) {
        const f = fixture('admin', Response.json({ success: true, [kind]: savedRow }));
        const result = await saveDesktopRecord(kind, { ...headers, body: { storeId, name: 'Fixture', supplierCode: 'S-1' } }, f.fetcher);
        assert.equal(result.status, 200);
        assert.equal(f.calls[1].method, 'POST');
        assert.deepEqual(f.calls[1].body, kind === 'category' ? { storeId, name: 'Fixture' } : { storeId, company_name: 'Fixture', supplier_code: 'S-1', status: 'active' });
    }
});

test('wrong origin, inactive staff, foreign store and excess KWD precision cannot cause a write', async () => {
    const fields = { storeId, name: 'Fixture', sku: 'SKU', barcode: '', cost: '1.125', price: '2.500' };
    for (const [f, request] of [
        [fixture(), { ...headers, origin: 'https://unrelated.invalid', body: fields }],
        [fixture('cashier'), { ...headers, body: fields }],
        [fixture('admin', undefined, false), { ...headers, body: fields }],
        [fixture(), { ...headers, body: { ...fields, storeId: id } }],
        [fixture(), { ...headers, body: { ...fields, price: '1.1234' } }],
    ] as const) {
        assert.equal((await saveDesktopRecord('product', request, f.fetcher)).status, 403);
        assert.ok(f.calls.every(call => call.method === 'GET'));
    }
});

test('an error after sending is uncertain and only one write is attempted', async () => {
    for (const reply of [Response.json({ error: 'private' }, { status: 500 }), Response.json({ success: true, category: { ...savedRow, store_id: id } })]) {
        const f = fixture('owner', reply);
        const result = await saveDesktopRecord('category', { ...headers, body: { storeId, name: 'Fixture' } }, f.fetcher);
        assert.deepEqual(JSON.parse(result.body), { code: 'SAVE_UNCONFIRMED' });
        assert.equal(f.calls.filter(call => call.method === 'POST').length, 1);
    }
});
