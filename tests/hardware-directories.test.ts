import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proxyRead } from '../server/readOnlyProxy.ts';
import { hardwareTargets } from '../src/integration/connectionConfig.ts';
import { allowedReadPath } from '../src/integration/readBoundary.ts';
import { decodeDirectoryPage, directoryRoutes } from '../src/integration/hardwareDirectories.ts';

const userId = '11111111-1111-4111-8111-111111111111';
const organizationId = '22222222-2222-4222-8222-222222222222';
const storeId = '33333333-3333-4333-8333-333333333333';
const id = '44444444-4444-4444-8444-444444444444';
const pathFor = (path: string, query = '') => `${path}?storeId=${storeId}&page=1&limit=10${query}`;
const startup = (role = 'owner', active = true, selectedStore = storeId) => ({
    user: { id: userId }, profile: { id: userId, organization_id: organizationId, role, is_active: active },
    organization: { id: organizationId, name: 'Example company' },
    stores: [{ id: selectedStore, organization_id: organizationId, name: 'Example store', business_type: 'hardware', currency: 'KWD' }],
});
const row = { id, store_id: storeId, organization_id: organizationId };
const request = (path: string, method = 'GET') => ({ method, path, authorization: 'Bearer fixture-token', apiOrigin: hardwareTargets.apiOrigin });
function fixture(payload: unknown, context: unknown = startup()) {
    const calls: string[] = [];
    const fetcher: typeof fetch = async (input, init) => {
        const url = new URL(String(input));
        assert.equal(init?.method, 'GET');
        calls.push(url.pathname + url.search);
        return Response.json(url.pathname === '/api/startup-context' ? context : payload);
    };
    return { fetcher, calls };
}

test('directory proxy projects reviewed GET registers, with no upstream pagination or unrelated fields', async () => {
    for (const [kind, payload, name] of [
        ['categories', { success: true, categories: [{ ...row, name: 'Fixture category', is_active: true }] }, 'Fixture category'],
        ['suppliers', { success: true, data: [{ ...row, company_name: 'Fixture supplier', status: 'active', email: 'private' }] }, 'Fixture supplier'],
        ['purchaseOrders', { success: true, data: [{ ...row, po_number: 'Fixture order', status: 'draft', suppliers: { email: 'private' } }] }, 'Fixture order'],
    ] as const) {
        const route = directoryRoutes[kind], f = fixture(payload);
        const result = await proxyRead(request(pathFor(route, '&search=fixture')), f.fetcher);
        assert.equal(result.status, 200);
        assert.deepEqual(f.calls, ['/api/startup-context', `${route}?storeId=${storeId}`]);
        assert.deepEqual(decodeDirectoryPage(JSON.parse(result.body), 1).rows.map(record => record.name), [name]);
        assert.ok(!result.body.includes('private'));
    }
});
test('unauthorized stores and operator roles stop before register access; writes and unit seeding paths stay blocked', async () => {
    for (const context of [startup('cashier'), startup('owner', false), startup('owner', true, id)]) {
        const f = fixture({}, context);
        const result = await proxyRead(request(pathFor(directoryRoutes.purchaseOrders)), f.fetcher);
        assert.equal(result.status, 403);
        assert.deepEqual(f.calls, ['/api/startup-context']);
    }
    const f = fixture({});
    assert.equal((await proxyRead(request(pathFor(directoryRoutes.categories), 'POST'), f.fetcher)).status, 405);
    assert.equal(allowedReadPath(pathFor('/api/hardware/product-units')), false);
    assert.equal(allowedReadPath(pathFor(directoryRoutes.suppliers, '&storeId=' + id)), false);
    assert.equal(f.calls.length, 0);
});
test('directories fail closed on unrelated rows and cap returned pages at ten records', async () => {
    const bad = fixture({ success: true, data: [{ ...row, store_id: id, po_number: 'Other store', status: 'draft' }] });
    assert.equal((await proxyRead(request(pathFor(directoryRoutes.purchaseOrders)), bad.fetcher)).status, 502);
    const data = Array.from({ length: 12 }, (_, i) => ({ ...row, id: `44444444-4444-4444-8444-${String(i).padStart(12, '0')}`, company_name: `Supplier ${i}`, status: 'active' }));
    const f = fixture({ success: true, data });
    const result = await proxyRead(request(pathFor(directoryRoutes.suppliers).replace('page=1', 'page=2')), f.fetcher);
    const page = decodeDirectoryPage(JSON.parse(result.body), 2);
    assert.equal(page.total, 12);
    assert.deepEqual(page.rows.map(row => row.name), ['Supplier 10', 'Supplier 11']);
});
