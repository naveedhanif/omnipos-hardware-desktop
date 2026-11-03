import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeRateDifferencePage } from '../src/integration/rateDifferenceRead.ts';
import { createReadOnlyWorkspace } from '../src/integration/readOnlyWorkspace.ts';
import { allowedReadPath } from '../src/integration/readBoundary.ts';
import { proxyRead } from '../server/readOnlyProxy.ts';
import { hardwareTargets } from '../src/integration/connectionConfig.ts';
import { connectionResults } from '../src/ui/connectionResults.ts';
const user = '11111111-1111-4111-8111-111111111111', org = '22222222-2222-4222-8222-222222222222', store = '33333333-3333-4333-8333-333333333333', id = '44444444-4444-4444-8444-444444444444';
const scope = { userId: user, organizationId: org, storeId: store, revision: 1 };
const row = () => ({ invoiceId: id, invoiceNumber: 'AP-FIXTURE', invoiceDate: '2026-11-03', postingStatus: 'draft', currency: 'KWD', supplierName: '<script>Fixture supplier</script>', productName: 'Fixture drill', productSku: null, poOrderedQty: '12.0000', receivedAcceptedQty: '10.0000', invoicedQty: '12.0000', quantityVariance: '2.0000', poUnitCost: '1.125000', invoicedUnitCost: '1.250000', unitCostVariance: '0.125000', lineTotalVariance: '3.750000', matchClassification: 'quantity_and_price_variance', varianceNotes: 'private notes' });
const page = (n = 1) => ({ success: true, data: { differences: [row()], pagination: { page: n, limit: 10, totalInvoices: n === 2 ? 11 : 1, totalPages: n === 2 ? 2 : 1 } } });
const context = (role = 'OWNER') => ({ user: { id: user }, profile: { id: user, organization_id: org, role, is_active: true }, organization: { id: org, name: 'Fixture company' }, stores: [{ id: store, organization_id: org, name: 'Fixture', business_type: 'hardware', currency: 'KWD' }] });
const response = (v: unknown) => ({ status: 200, body: JSON.stringify(v) });
const route = '/api/hardware/supplier-invoices/reports/rate-differences';
const path = `${route}?storeId=${store}&page=1&limit=10`;
test('rate report preserves backend exact unit/quantity/money differences without raw notes or recalculation', () => {
    const data = decodeRateDifferencePage(page(2), scope, 2);
    assert.equal(data.rows[0].quantityVariance, '2.0000');
    assert.equal(data.rows[0].unitCostVariance, '0.125000');
    assert.equal(data.rows[0].lineTotalVariance, '3.750000');
    assert.equal(JSON.stringify(data).includes('private notes'), false);
    const html = connectionResults({ kind: 'rateDifferences', data }, 'Fixture', null, true);
    assert.ok(html.includes('11 qualifying invoices'));
    assert.ok(html.includes('1 variance or incomplete-evidence lines'));
    assert.ok(html.includes('Unit-rate difference'));
    assert.ok(html.includes('Monetary line impact'));
    assert.ok(html.includes('&lt;script&gt;Fixture supplier&lt;/script&gt;'));
    assert.equal(/<button|<form|<input|<script>/.test(html), false);
});
test('invoice paging accepts many lines per invoice and empty lines despite nonzero qualifying invoices', () => {
    const body = page();
    body.data.differences = Array.from({ length: 12 }, () => row());
    assert.equal(decodeRateDifferencePage(body, scope).rows.length, 12);
    body.data.differences = [];
    const data = decodeRateDifferencePage(body, scope);
    assert.equal(data.total, 1);
    const html = connectionResults({ kind: 'rateDifferences', data }, 'Fixture', null);
    assert.ok(html.includes('does not prove there are no qualifying invoices'));
    assert.ok(html.includes('1 qualifying invoices'));
    const empty = decodeRateDifferencePage({ success: true, data: { differences: [], pagination: { page: 3, limit: 10, totalInvoices: 0, totalPages: 1 } } }, scope, 3);
    assert.equal(empty.total, 0);
});
test('missing match evidence requires unavailable values, never zero comparison placeholders', () => {
    const incomplete = { ...row(), matchClassification: 'missing_grn_evidence', poOrderedQty: null, receivedAcceptedQty: null, invoicedQty: null, quantityVariance: null, poUnitCost: null, invoicedUnitCost: null, unitCostVariance: null, lineTotalVariance: null };
    const body = { ...page(), data: { ...page().data, differences: [incomplete] } };
    const data = decodeRateDifferencePage(body, scope);
    assert.equal(data.rows[0].unitCostVariance, null);
    assert.ok(connectionResults({ kind: 'rateDifferences', data }, 'Fixture', null).includes('Unavailable'));
    assert.throws(() => decodeRateDifferencePage({ ...body, data: { ...body.data, differences: [{ ...incomplete, lineTotalVariance: '0.000' }] } }, scope));
    assert.throws(() => decodeRateDifferencePage({ ...page(), data: { ...page().data, differences: [{ ...row(), unitCostVariance: null }] } }, scope));
});
test('report rejects wrong page/count/status/currency/date, malformed decimals and contradictory invoice metadata', () => {
    for (const change of [{ invoiceId: 'bad' }, { postingStatus: 'posted' }, { currency: 'kwd' }, { invoiceDate: '2026-02-30' }, { unitCostVariance: 0.125 }, { invoicedQty: '1e3' }, { matchClassification: 'matched' }, { matchClassification: ['price_variance'] }, { store_id: org }, { organization_id: user }])
        assert.throws(() => decodeRateDifferencePage({ ...page(), data: { ...page().data, differences: [{ ...row(), ...change }] } }, scope));
    for (const change of [{ page: 2 }, { limit: 20 }, { totalInvoices: -1 }, { totalPages: 0 }, { totalInvoices: 0 }])
        assert.throws(() => decodeRateDifferencePage({ ...page(), data: { ...page().data, pagination: { ...page().data.pagination, ...change } } }, scope));
    assert.throws(() => decodeRateDifferencePage({ ...page(), data: { ...page().data, differences: [row(), { ...row(), invoiceNumber: 'Wrong' }] } }, scope));
    assert.throws(() => decodeRateDifferencePage({ ...page(), data: { ...page().data, differences: [row(), { ...row(), invoiceId: user }] } }, scope));
    assert.throws(() => decodeRateDifferencePage({ ...page(), data: { ...page().data, differences: Array.from({ length: 2001 }, () => row()) } }, scope));
    assert.throws(() => decodeRateDifferencePage({ ...page(), demoFallback: true }, scope));
});
test('manual report pages recheck owner/admin scope; unsupported search is refused before any read', async () => {
    const calls: string[] = [];
    let role = 'OWNER';
    const model = createReadOnlyWorkspace({ now: () => 1000, signIn: async () => ({ userId: user, accessToken: 'fixture-token', expiresAt: 999999 }), transport: async (req) => { calls.push(req.url); return response(req.url === '/api/startup-context' ? context(role) : page(2)); } });
    await model.signIn('fixture@example.invalid', 'fixture', true);
    model.selectStore(store);
    await assert.rejects(model.read('rateDifferences', { search: 'not supported' }));
    assert.equal(calls.length, 1);
    const result = await model.read('rateDifferences', { page: 2 });
    assert.equal(result.kind, 'rateDifferences');
    assert.equal(calls[1], '/api/startup-context');
    assert.equal(calls[2], `${route}?storeId=${store}&page=2&limit=10`);
    role = 'CASHIER';
    await assert.rejects(model.read('rateDifferences'), /Owner\/admin/);
    assert.equal(calls.length, 4);
    assert.equal(model.summary(), null);
});
test('report currency mismatch fails closed without fabricating results or retry', async () => {
    let calls = 0;
    const model = createReadOnlyWorkspace({ now: () => 1000, signIn: async () => ({ userId: user, accessToken: 'fixture-token', expiresAt: 999999 }), transport: async (req) => { calls++; return response(req.url === '/api/startup-context' ? context() : { ...page(), data: { ...page().data, differences: [{ ...row(), currency: 'EUR' }] } }); } });
    await model.signIn('fixture@example.invalid', 'fixture', true);
    model.selectStore(store);
    await assert.rejects(model.read('rateDifferences'));
    assert.equal(model.summary(), null);
    assert.equal(calls, 3);
});
test('report proxy refuses search, extra filters and writes; preserves only reviewed AP capability errors', async () => {
    assert.ok(allowedReadPath(path));
    for (const suffix of ['&search=Drill', '&search=', '&status=draft', '&page=1', '&supplierId=' + id])
        assert.equal(allowedReadPath(path + suffix), false);
    const input = { method: 'GET', path, authorization: 'Bearer fixture-token', apiOrigin: hardwareTargets.apiOrigin };
    let calls = 0;
    const fetcher = async (url: unknown, options?: RequestInit) => { calls++; assert.equal(url, hardwareTargets.apiOrigin + path); assert.equal(options?.method, 'GET'); assert.equal(options?.body, undefined); return Response.json(page()); };
    assert.equal((await proxyRead(input, fetcher)).status, 200);
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'])
        assert.equal((await proxyRead({ ...input, method }, fetcher)).status, 405);
    assert.equal(calls, 1);
    for (const code of ['AP_FEATURE_DISABLED', 'AP_SCHEMA_UNAVAILABLE']) {
        const result = await proxyRead(input, async () => Response.json({ success: false, code, error: 'private SQL', correlationId: id }, { status: 503 }));
        assert.equal(JSON.parse(result.body).code, code);
        assert.equal(result.body.includes('private'), false);
    }
});
