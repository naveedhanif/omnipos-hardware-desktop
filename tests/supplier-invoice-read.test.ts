import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeSupplierInvoicePage } from '../src/integration/supplierInvoiceRead.ts';
import { createReadOnlyWorkspace } from '../src/integration/readOnlyWorkspace.ts';
import { allowedReadPath } from '../src/integration/readBoundary.ts';
import { proxyRead } from '../server/readOnlyProxy.ts';
import { hardwareTargets } from '../src/integration/connectionConfig.ts';
import { connectionResults } from '../src/ui/connectionResults.ts';
import { connectionError } from '../src/ui/connectionError.ts';
import { HardwareReadError } from '../src/integration/contracts.ts';
const user = '11111111-1111-4111-8111-111111111111', org = '22222222-2222-4222-8222-222222222222', store = '33333333-3333-4333-8333-333333333333', id = '44444444-4444-4444-8444-444444444444';
const scope = { userId: user, organizationId: org, storeId: store, revision: 1 };
const row = () => ({ id, organization_id: org, store_id: store, supplier_id: id, suppliers: { id, company_name: '<script>Fixture supply</script>' }, supplier_invoice_number: 'BILL-FIXTURE', internal_invoice_number: 'AP-FIXTURE', invoice_date: '2026-11-03', due_date: null, posting_status: 'received', match_status: 'unmatched', payment_status: 'unpaid', procurement_mode: 'direct_purchase', currency: 'KWD', total_amount: '18.750000', supplier_invoice_lines: [{ notes: 'private-line-notes' }], notes: 'private-invoice-notes' });
const page = (n = 1) => ({ success: true, data: [row()], pagination: { page: n, limit: 10, total: n === 2 ? 11 : 1, totalPages: n === 2 ? 2 : 1 } });
const context = (role = 'OWNER') => ({ user: { id: user }, profile: { id: user, organization_id: org, role, is_active: true }, organization: { id: org, name: 'Fixture company' }, stores: [{ id: store, organization_id: org, name: 'Fixture', business_type: 'hardware', currency: 'KWD' }] });
const response = (v: unknown) => ({ status: 200, body: JSON.stringify(v) });
const path = `/api/hardware/supplier-invoices?storeId=${store}&page=1&limit=10`;
test('supplier register preserves recorded decimals and separate statuses, dropping raw joined/private data', () => {
    const data = decodeSupplierInvoicePage(page(2), scope, 2);
    const r = data.rows[0];
    assert.equal(r.total, '18.750000');
    assert.equal(r.postingStatus, 'received');
    assert.equal(r.matchStatus, 'unmatched');
    assert.equal(r.dueDate, null);
    assert.equal(data.total, 11);
    assert.equal(JSON.stringify(data).includes('private-'), false);
    assert.equal('paymentStatus' in r, false);
    const html = connectionResults({ kind: 'supplierInvoices', data }, 'Fixture', null, true);
    assert.ok(html.includes('&lt;script&gt;Fixture supply&lt;/script&gt;'));
    assert.ok(html.includes('18.750000'));
    assert.ok(html.includes('Page 2'));
    assert.equal(html.includes('<script>'), false);
    assert.equal(/<button|<form|<input/.test(html), false);
});
test('supplier register keeps nulls and genuine zero distinct; empty page metadata matches source', () => {
    const original = row();
    const nulls = decodeSupplierInvoicePage({ ...page(), data: [{ ...original, total_amount: null, currency: null, payment_status: undefined, suppliers: null }] }, scope);
    assert.equal(nulls.rows[0].total, null);
    assert.equal(nulls.rows[0].supplier, null);
    assert.equal(decodeSupplierInvoicePage({ ...page(), data: [{ ...original, total_amount: '0.000' }] }, scope).rows[0].total, '0.000');
    const empty = decodeSupplierInvoicePage({ success: true, data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } }, scope);
    assert.equal(empty.totalPages, 0);
    assert.ok(connectionResults({ kind: 'supplierInvoices', data: empty }, 'Fixture', null).includes('empty result for this page and search'));
});
test('supplier invoice decoder rejects foreign scope, bad joins, duplicates, money, dates and inconsistent pagination', () => {
    for (const change of [{ organization_id: user }, { store_id: org }, { id: 'bad' }, { suppliers: { id: user, company_name: 'Wrong' } }, { invoice_date: '2026-02-30' }, { due_date: 'tomorrow' }, { total_amount: '1,000' }, { total_amount: Infinity }, { total_amount: undefined }, { posting_status: ['posted'] }, { currency: 'kwd' }]) {
        assert.throws(() => decodeSupplierInvoicePage({ ...page(), data: [{ ...row(), ...change }] }, scope));
    }
    assert.throws(() => decodeSupplierInvoicePage({ ...page(), data: [row(), row()], pagination: { page: 1, limit: 10, total: 2, totalPages: 1 } }, scope));
    for (const change of [{ page: 2 }, { limit: 20 }, { total: 2 }, { totalPages: 0 }, { total: -1 }])
        assert.throws(() => decodeSupplierInvoicePage({ ...page(), pagination: { ...page().pagination, ...change } }, scope));
    for (const change of [{ success: false }, { demoFallback: true }, { error: 'refused' }, { data: null }])
        assert.throws(() => decodeSupplierInvoicePage({ ...page(), ...change }, scope));
});
test('supplier invoices require fresh owner/admin authority and request only bounded reference search', async () => {
    const calls: string[] = [];
    let role = 'OWNER';
    const model = createReadOnlyWorkspace({ now: () => 1000, signIn: async () => ({ userId: user, accessToken: 'fixture-token', expiresAt: 999999 }), transport: async (req) => { calls.push(req.url); return response(req.url === '/api/startup-context' ? context(role) : page(2)); } });
    await model.signIn('fixture@example.invalid', 'fixture', true);
    model.selectStore(store);
    const result = await model.read('supplierInvoices', { page: 2, search: 'AP 100' });
    assert.equal(result.kind, 'supplierInvoices');
    assert.deepEqual(calls.slice(0, 2), ['/api/startup-context', '/api/startup-context']);
    assert.equal(calls[2], `/api/hardware/supplier-invoices?storeId=${store}&page=2&limit=10&search=AP+100`);
    assert.ok(allowedReadPath(calls[2]));
    role = 'CASHIER';
    await assert.rejects(model.read('supplierInvoices'), /Owner\/admin/);
    assert.equal(calls.length, 4);
    assert.equal(model.summary(), null);
    for (const suffix of ['&status=posted', '&supplierId=' + id, '&search=x%2Cy', '&page=1'])
        assert.equal(allowedReadPath(path + suffix), false);
    assert.equal(allowedReadPath(`/api/hardware/supplier-invoices/${id}?storeId=${store}&page=1&limit=10`), false);
});
test('supplier invoice currency mismatch and disabled feature errors clear records/session with no fallback or retry', async () => {
    for (const payload of [response({ ...page(), data: [{ ...row(), currency: 'EUR' }] }), { status: 503, body: JSON.stringify({ code: 'AP_FEATURE_DISABLED', error: 'private error text' }) }]) {
        let calls = 0;
        const model = createReadOnlyWorkspace({ now: () => 1000, signIn: async () => ({ userId: user, accessToken: 'fixture-token', expiresAt: 999999 }), transport: async (req) => { calls++; return req.url === '/api/startup-context' ? response(context()) : payload; } });
        await model.signIn('fixture@example.invalid', 'fixture', true);
        model.selectStore(store);
        await assert.rejects(model.read('supplierInvoices'));
        assert.equal(model.summary(), null);
        assert.equal(calls, 3);
        await assert.rejects(model.read('supplierInvoices'));
        assert.equal(calls, 3);
    }
});
test('proxy forwards exact supplier GET but no write, detail, matching or capability endpoint', async () => {
    let calls = 0;
    const input = { method: 'GET', path, authorization: 'Bearer fixture-token', apiOrigin: hardwareTargets.apiOrigin };
    const fetcher = async (url: unknown, options?: RequestInit) => { calls++; assert.equal(url, hardwareTargets.apiOrigin + path); assert.equal(options?.method, 'GET'); assert.equal(options?.redirect, 'error'); assert.equal(options?.body, undefined); return Response.json(page()); };
    assert.equal((await proxyRead(input, fetcher)).status, 200);
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'])
        assert.equal((await proxyRead({ ...input, method }, fetcher)).status, 405);
    for (const extra of ['/' + id, '/capability/status', '/' + id + '/validate-match'])
        assert.equal((await proxyRead({ ...input, path: `/api/hardware/supplier-invoices${extra}?storeId=${store}&page=1&limit=10` }, fetcher)).status, 404);
    assert.equal(calls, 1);
});
test('proxy preserves only reviewed supplier capability errors and safe correlation, never raw exception text', async () => {
    const input = { method: 'GET', path, authorization: 'Bearer fixture-token', apiOrigin: hardwareTargets.apiOrigin };
    for (const code of ['AP_FEATURE_DISABLED', 'AP_SCHEMA_UNAVAILABLE']) {
        const result = await proxyRead(input, async () => Response.json({ success: false, code, error: 'private upstream SQL', correlationId: id, token: 'private-token' }, { status: 503 }));
        assert.equal(result.status, 503);
        const body = JSON.parse(result.body);
        assert.equal(body.code, code);
        assert.equal(body.correlationId, id);
        assert.equal(result.body.includes('private'), false);
        const message = connectionError(new HardwareReadError('http', 'private error', 503, code, id));
        assert.equal(message.includes('private'), false);
        assert.ok(message.includes('No automatic retry'));
        assert.ok(message.includes(code));
    }
    const bad = await proxyRead(input, async () => Response.json({ success: false, code: 'UNREVIEWED_CODE', error: 'private upstream SQL' }, { status: 503 }));
    assert.equal(JSON.parse(bad.body).code, 'UPSTREAM_READ_REFUSED');
    const invalidRef = await proxyRead(input, async () => Response.json({ success: false, code: 'AP_FEATURE_DISABLED', correlationId: 'private-reference' }, { status: 503 }));
    assert.equal(JSON.parse(invalidRef.body).correlationId, undefined);
    const otherRoute = await proxyRead({ ...input, path: path.replace('supplier-invoices', 'products') }, async () => Response.json({ success: false, code: 'AP_FEATURE_DISABLED' }, { status: 503 }));
    assert.equal(JSON.parse(otherRoute.body).code, 'UPSTREAM_READ_REFUSED');
});
