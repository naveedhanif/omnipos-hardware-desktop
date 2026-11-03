import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeSupplierReturnPage, returnStatusLabels } from '../src/integration/supplierReturnRead.ts';
import { createReadOnlyWorkspace } from '../src/integration/readOnlyWorkspace.ts';
import { allowedReadPath } from '../src/integration/readBoundary.ts';
import { proxyRead } from '../server/readOnlyProxy.ts';
import { hardwareTargets } from '../src/integration/connectionConfig.ts';
import { connectionResults } from '../src/ui/connectionResults.ts';
import { connectionError } from '../src/ui/connectionError.ts';
import { HardwareReadError } from '../src/integration/contracts.ts';
const user = '11111111-1111-4111-8111-111111111111', org = '22222222-2222-4222-8222-222222222222', store = '33333333-3333-4333-8333-333333333333', id = '44444444-4444-4444-8444-444444444444';
const scope = { userId: user, organizationId: org, storeId: store, revision: 1 };
const row = () => ({ id, returnNumber: 'RETURN-FIXTURE', sourceKind: 'po_grn', status: 'pending_approval', reason: 'private-reason', currency: 'KWD', createdAt: '2026-11-03T10:00:00Z', approvedAt: null, postedAt: null, supplier: { id, name: '<script>Fixture supplier</script>' }, sourceReference: { kind: 'po_grn', id, label: 'GRN-FIXTURE' } });
const page = (n = 1) => ({ success: true, data: [row()], pagination: { page: n, limit: 10, total: n === 2 ? 11 : 1, totalPages: n === 2 ? 2 : 1 }, draftActionsEnabled: true, postingEnabled: true });
const context = (role = 'OWNER') => ({ user: { id: user }, profile: { id: user, organization_id: org, role, is_active: true }, organization: { id: org, name: 'Fixture company' }, stores: [{ id: store, organization_id: org, name: 'Fixture', business_type: 'hardware', currency: 'KWD' }] });
const response = (v: unknown) => ({ status: 200, body: JSON.stringify(v) });
const path = `/api/hardware/supplier-returns?storeId=${store}&page=1&limit=10`;
test('return register preserves source/status meanings, discards reasons/flags and never exposes write controls', () => {
    const data = decodeSupplierReturnPage(page(2), scope, 2);
    assert.equal(data.rows[0].status, 'pending_approval');
    assert.equal(data.rows[0].sourceReference, 'GRN-FIXTURE');
    assert.equal(data.rows[0].postedAt, null);
    assert.equal(data.totalPages, 2);
    assert.equal(JSON.stringify(data).includes('private-reason'), false);
    assert.equal('postingEnabled' in data, false);
    assert.equal('draftActionsEnabled' in data, false);
    const html = connectionResults({ kind: 'supplierReturns', data }, 'Fixture', null, true);
    assert.ok(html.includes('Submitted — awaiting posting'));
    assert.ok(html.includes('not independent approval'));
    assert.ok(html.includes('&lt;script&gt;Fixture supplier&lt;/script&gt;'));
    assert.equal(html.includes('<script>'), false);
    assert.equal(/<button|<form|<input|href=/.test(html), false);
    assert.ok(html.includes('Page 2'));
    assert.equal(returnStatusLabels.posted_credit_pending, 'Posted — credit pending');
});
test('returns preserve missing/direct source evidence without inventing a GRN or credit', () => {
    const data = decodeSupplierReturnPage({ ...page(), data: [{ ...row(), sourceKind: 'direct_purchase_receipt', sourceReference: { kind: 'direct_purchase_receipt', id, label: null }, status: 'posted_credit_pending', postedAt: '2026-11-03T11:00:00Z', supplier: null }] }, scope);
    assert.equal(data.rows[0].sourceReference, null);
    const html = connectionResults({ kind: 'supplierReturns', data }, 'Fixture', null);
    assert.ok(html.includes('Direct purchase receipt'));
    assert.ok(html.includes('Reference unavailable'));
    assert.ok(html.includes('does not establish a supplier credit'));
    const missing = decodeSupplierReturnPage({ ...page(), data: [{ ...row(), sourceReference: null }] }, scope);
    assert.equal(missing.rows[0].sourceReference, null);
    const empty = decodeSupplierReturnPage({ ...page(), data: [], pagination: { page: 3, limit: 10, total: 0, totalPages: 1 }, draftActionsEnabled: false, postingEnabled: false }, scope, 3);
    assert.equal(empty.total, 0);
    assert.equal(empty.rows.length, 0);
});
test('returns reject malformed status/source/join/date, duplicate IDs, contradictory scope and pagination', () => {
    for (const change of [{ id: 'bad' }, { status: '__proto__' }, { status: 'approved' }, { status: ['draft'] }, { sourceKind: 'unknown' }, { sourceKind: ['po_grn'] }, { currency: 'kwd' }, { postedAt: 'bad' }, { createdAt: null }, { supplier: { id: 'bad', name: 'Fixture' } }, { sourceReference: { kind: 'direct_purchase_receipt', id, label: null } }, { store_id: org }, { organization_id: user }])
        assert.throws(() => decodeSupplierReturnPage({ ...page(), data: [{ ...row(), ...change }] }, scope));
    assert.throws(() => decodeSupplierReturnPage({ ...page(), data: [row(), row()], pagination: { page: 1, limit: 10, total: 2, totalPages: 1 } }, scope));
    for (const change of [{ page: 2 }, { limit: 50 }, { total: 2 }, { totalPages: 0 }, { total: -1 }])
        assert.throws(() => decodeSupplierReturnPage({ ...page(), pagination: { ...page().pagination, ...change } }, scope));
    for (const change of [{ success: false }, { demoFallback: true }, { postingEnabled: 'true' }, { draftActionsEnabled: undefined }, { error: 'refused' }])
        assert.throws(() => decodeSupplierReturnPage({ ...page(), ...change }, scope));
});
test('manual return reads recheck role each time and request only bounded reference search', async () => {
    const calls: string[] = [];
    let role = 'OWNER';
    const model = createReadOnlyWorkspace({ now: () => 1000, signIn: async () => ({ userId: user, accessToken: 'fixture-token', expiresAt: 999999 }), transport: async (req) => { calls.push(req.url); return response(req.url === '/api/startup-context' ? context(role) : page(2)); } });
    await model.signIn('fixture@example.invalid', 'fixture', true);
    model.selectStore(store);
    const result = await model.read('supplierReturns', { page: 2, search: 'RET 100' });
    assert.equal(result.kind, 'supplierReturns');
    assert.deepEqual(calls.slice(0, 2), ['/api/startup-context', '/api/startup-context']);
    assert.equal(calls[2], `/api/hardware/supplier-returns?storeId=${store}&page=2&limit=10&search=RET+100`);
    assert.ok(allowedReadPath(calls[2]));
    role = 'CASHIER';
    await assert.rejects(model.read('supplierReturns'), /Owner\/admin/);
    assert.equal(calls.length, 4);
    assert.equal(model.summary(), null);
});
test('return currency mismatch/unavailable errors clear the session with no fabricated empty result or retry', async () => {
    for (const payload of [response({ ...page(), data: [{ ...row(), currency: 'EUR' }] }), { status: 503, body: JSON.stringify({ code: 'HARDWARE_RETURNS_UNAVAILABLE' }) }]) {
        let calls = 0;
        const model = createReadOnlyWorkspace({ now: () => 1000, signIn: async () => ({ userId: user, accessToken: 'fixture-token', expiresAt: 999999 }), transport: async (req) => { calls++; return req.url === '/api/startup-context' ? response(context()) : payload; } });
        await model.signIn('fixture@example.invalid', 'fixture', true);
        model.selectStore(store);
        await assert.rejects(model.read('supplierReturns'));
        assert.equal(model.summary(), null);
        assert.equal(calls, 3);
        await assert.rejects(model.read('supplierReturns'));
        assert.equal(calls, 3);
    }
});
test('supplier return proxy allows exact GET and refuses writes, sources/details and extra filters', async () => {
    let calls = 0;
    const input = { method: 'GET', path, authorization: 'Bearer fixture-token', apiOrigin: hardwareTargets.apiOrigin };
    const fetcher = async (url: unknown, options?: RequestInit) => { calls++; assert.equal(url, hardwareTargets.apiOrigin + path); assert.equal(options?.method, 'GET'); assert.equal(options?.body, undefined); assert.equal(options?.redirect, 'error'); return Response.json(page()); };
    assert.equal((await proxyRead(input, fetcher)).status, 200);
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'])
        assert.equal((await proxyRead({ ...input, method }, fetcher)).status, 405);
    for (const extra of ['/' + id, '/sources', '/' + id + '/submit', '/' + id + '/post'])
        assert.equal((await proxyRead({ ...input, path: `/api/hardware/supplier-returns${extra}?storeId=${store}&page=1&limit=10` }, fetcher)).status, 404);
    for (const suffix of ['&status=draft', '&sourceKind=all', '&supplierId=' + id, '&page=1', '&search=x%2Cy'])
        assert.equal(allowedReadPath(path + suffix), false);
    assert.equal(calls, 1);
});
test('returns unavailable diagnostic is route/status-specific, safely projected and never shown as zero records', async () => {
    const input = { method: 'GET', path, authorization: 'Bearer fixture-token', apiOrigin: hardwareTargets.apiOrigin };
    const body = { success: false, code: 'HARDWARE_RETURNS_UNAVAILABLE', error: 'private SQL', correlationId: id, secret: 'private-token' };
    const result = await proxyRead(input, async () => Response.json(body, { status: 503 }));
    assert.equal(result.status, 503);
    const safe = JSON.parse(result.body);
    assert.equal(safe.code, body.code);
    assert.equal(safe.correlationId, id);
    assert.equal(result.body.includes('private'), false);
    const message = connectionError(new HardwareReadError('http', 'private error', 503, safe.code));
    assert.ok(message.includes('not an empty returns list'));
    assert.equal(message.includes('private'), false);
    for (const [route, status, code] of [[path.replace('supplier-returns', 'supplier-invoices'), 503, body.code], [path, 403, body.code], [path, 503, 'AP_FEATURE_DISABLED']] as const) {
        const refused = await proxyRead({ ...input, path: route }, async () => Response.json({ ...body, code }, { status }));
        assert.equal(JSON.parse(refused.body).code, 'UPSTREAM_READ_REFUSED');
    }
});
