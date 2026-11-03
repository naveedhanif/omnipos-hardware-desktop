import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeReceiptPage } from '../src/integration/receiptRead.ts';
import { createReadOnlyWorkspace } from '../src/integration/readOnlyWorkspace.ts';
import { allowedReadPath } from '../src/integration/readBoundary.ts';
import { connectionResults } from '../src/ui/connectionResults.ts';
const user = '11111111-1111-4111-8111-111111111111', org = '22222222-2222-4222-8222-222222222222', store = '33333333-3333-4333-8333-333333333333', id = '44444444-4444-4444-8444-444444444444', product = '55555555-5555-4555-8555-555555555555', line = '66666666-6666-4666-8666-666666666666';
const scope = { userId: user, organizationId: org, storeId: store, revision: 1 };
const row = () => ({ id, organization_id: org, store_id: store, grn_number: 'FIXTURE-001', received_at: '2026-11-03T10:00:00Z', supplier_delivery_reference: null, suppliers: { id, company_name: '<script>fixture</script>', email: 'private@example.invalid' }, supplier_id: id, purchase_orders: { id, po_number: 'PO-FIXTURE' }, purchase_order_id: id, inventory_locations: null, discrepancy_status: 'partial_discrepancy', inspection_status: 'pending_inspection', goods_receipt_lines: [{ id: line, goods_receipt_id: id, product_id: product, products: { id: product, name: 'Fixture drill', sku: 'FIXTURE' }, delivered_qty: '1.2500', accepted_qty: '0.7500', rejected_qty: '0', damaged_qty: null, quarantined_qty: '0.5000', unit_cost: '1.125000' }] });
const page = (n = 1) => ({ success: true, grnAvailable: true, data: [row()], total: n === 2 ? 11 : 1, page: n, limit: 10 });
const context = (role = 'OWNER') => ({ user: { id: user }, profile: { id: user, organization_id: org, role, is_active: true }, organization: { id: org, name: 'Fixture company' }, stores: [{ id: store, organization_id: org, name: 'Fixture', business_type: 'hardware', currency: 'KWD' }] });
const response = (v: unknown) => ({ status: 200, body: JSON.stringify(v) });
test('goods receipt projection preserves decimals and pending inspection without retaining private joins', () => {
    const data = decodeReceiptPage(page(2), scope, 2);
    assert.equal(data.totalPages, 2);
    assert.equal(data.rows[0].lines[0].accepted, '0.7500');
    assert.equal(data.rows[0].lines[0].unitCost, '1.125000');
    assert.equal(data.rows[0].lines[0].damaged, null);
    assert.equal(data.rows[0].inspection, 'pending_inspection');
    assert.equal(JSON.stringify(data).includes('private@example'), false);
    const html = connectionResults({ kind: 'receipts', data }, 'Fixture', null, true);
    assert.ok(html.includes('&lt;script&gt;fixture&lt;/script&gt;'));
    assert.ok(html.includes('0.7500'));
    assert.ok(html.includes('<details'));
    assert.equal(html.includes('<script>'), false);
    assert.equal(/<button|<form|<input/.test(html), false);
});
test('unavailable receipts never become zero receipts; genuine empty remains distinct', () => {
    const body = { success: true, grnAvailable: false, data: [], total: 0, page: 1, limit: 10 };
    const data = decodeReceiptPage(body, scope);
    assert.equal(data.total, null);
    assert.equal(data.totalPages, null);
    const html = connectionResults({ kind: 'receipts', data }, 'Fixture', null, true);
    assert.ok(html.includes('does not mean zero receipts'));
    assert.equal(html.includes('Showing 0'), false);
    assert.equal(html.includes('Page 1'), false);
    const empty = decodeReceiptPage({ ...body, grnAvailable: true }, scope);
    assert.equal(empty.total, 0);
    assert.equal(empty.available, true);
    assert.throws(() => decodeReceiptPage({ ...body, data: [row()] }, scope));
});
test('receipt decoder refuses cross-scope records, malformed joins, duplicates and incomplete pages', () => {
    for (const change of [
        { organization_id: user }, { store_id: org }, { id: 'bad' }, { received_at: 'bad' },
        { inspection_status: ['passed'] }, { discrepancy_status: ['none'] }, { inspection_status: 'unknown' }, { discrepancy_status: 'unknown' },
        { suppliers: { id: user, company_name: 'Wrong' } }, { goods_receipt_lines: undefined },
        { goods_receipt_lines: Array.from({ length: 201 }, () => row().goods_receipt_lines[0]) },
    ])
        assert.throws(() => decodeReceiptPage({ ...page(), data: [{ ...row(), ...change }] }, scope));
    for (const change of [{ product_id: 'bad' }, { goods_receipt_id: user }, { organization_id: user }, { store_id: org }, { accepted_qty: '-1' }, { unit_cost: 'NaN' }, { products: { id: user, name: 'Wrong', sku: 'X' } }]) {
        assert.throws(() => decodeReceiptPage({ ...page(), data: [{ ...row(), goods_receipt_lines: [{ ...row().goods_receipt_lines[0], ...change }] }] }, scope));
    }
    assert.throws(() => decodeReceiptPage({ ...page(), data: [row(), row()], total: 2 }, scope));
    assert.throws(() => decodeReceiptPage({ ...page(), data: [{ ...row(), goods_receipt_lines: [row().goods_receipt_lines[0], row().goods_receipt_lines[0]] }] }, scope));
    for (const change of [{ page: 2 }, { total: 11 }, { limit: 100 }, { success: false }, { demoFallback: true }, { grnAvailable: undefined }])
        assert.throws(() => decodeReceiptPage({ ...page(), ...change }, scope));
});
test('manual receipt reads revalidate access and request only the bounded verified endpoint', async () => {
    const calls: string[] = [];
    const model = createReadOnlyWorkspace({ now: () => 1000, signIn: async () => ({ userId: user, accessToken: 'fixture-token', expiresAt: 999999 }), transport: async (req) => { calls.push(req.url); return response(req.url === '/api/startup-context' ? context() : page(2)); } });
    await model.signIn('fixture@example.invalid', 'fixture', true);
    assert.equal(model.summary()?.canReadPurchasing, true);
    model.selectStore(store);
    const result = await model.read('receipts', { page: 2, search: 'GRN 100' });
    assert.equal(result.kind, 'receipts');
    assert.deepEqual(calls.slice(0, 2), ['/api/startup-context', '/api/startup-context']);
    assert.equal(calls[2], `/api/hardware/goods-receipts?storeId=${store}&page=2&limit=10&search=GRN+100`);
    assert.ok(allowedReadPath(calls[2]));
    for (const query of ['limit=100', 'limit=10&poId=' + id, 'limit=10&search=x%2Cy', 'limit=10&page=1'])
        assert.equal(allowedReadPath(`/api/hardware/goods-receipts?storeId=${store}&page=1&${query}`), false);
    assert.equal(allowedReadPath(`/api/hardware/goods-receipts/${id}?storeId=${store}&page=1&limit=10`), false);
    assert.equal(allowedReadPath(`/api/hardware/purchase-orders?storeId=${store}&page=1&limit=10`), false);
});
test('revoked purchasing role stops before receipt fetch and clears the session', async () => {
    let role = 'OWNER';
    const calls: string[] = [];
    const model = createReadOnlyWorkspace({ now: () => 1000, signIn: async () => ({ userId: user, accessToken: 'fixture-token', expiresAt: 999999 }), transport: async (req) => { calls.push(req.url); return response(context(role)); } });
    await model.signIn('fixture@example.invalid', 'fixture', true);
    model.selectStore(store);
    role = 'CASHIER';
    await assert.rejects(model.read('receipts'), /Owner\/admin/);
    assert.equal(calls.length, 2);
    assert.equal(model.summary(), null);
});
