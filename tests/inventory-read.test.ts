import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeInventoryPage } from '../src/integration/inventoryRead.ts';
import { createHardwareReadAdapter } from '../src/integration/hardwareReadAdapter.ts';
import { createConnectionCheck } from '../src/integration/connectionCheck.ts';
import { allowedReadPath } from '../src/integration/readBoundary.ts';
import { proxyRead } from '../server/readOnlyProxy.ts';
import { hardwareTargets } from '../src/integration/connectionConfig.ts';
import { connectionResults } from '../src/ui/connectionResults.ts';
const user = '11111111-1111-4111-8111-111111111111', org = '22222222-2222-4222-8222-222222222222', store = '33333333-3333-4333-8333-333333333333';
const scope = { userId: user, organizationId: org, storeId: store, revision: 1 };
const path = `/api/hardware/inventory/balances?storeId=${store}&page=1&limit=10`;
const balance = (patch: Record<string, unknown> = {}) => ({ id: '44444444-4444-4444-8444-444444444444', product_id: '55555555-5555-4555-8555-555555555555', product_name: 'Fixture drill', sku: 'FIXTURE', uom: 'pcs', location_id: null, location_name: null, bin_location: null, qty_on_hand: 9007199254740994, qty_on_hand_decimal: '9007199254740993.000001', avg_cost: '1.000', stock_value: '9007199254740993.000', valuation_status: 'valued', valuation_issue: null, stock_status: 'healthy', stock_status_reason: null, ...patch });
const payload = (patch: Record<string, unknown> = {}) => ({ success: true, data: [balance()], pagination: { total: 1, page: 1, limit: 10, totalPages: 1 }, valuation: { currency: 'KWD', fractionDigits: 3, rounding: 'per_balance_half_away_from_zero' }, ...patch });
const startup = () => ({ user: { id: user }, profile: { id: user, organization_id: org, role: 'OWNER', is_active: true }, organization: { id: org, name: 'Fixture company' }, stores: [{ id: store, organization_id: org, name: 'Fixture store', business_type: 'hardware', currency: 'KWD' }] });
const session = { userId: user, accessToken: 'fixture-token', expiresAt: 200000 };
test('stock projection preserves exact decimal text and does not invent response scope or location IDs', () => {
    const result = decodeInventoryPage(payload(), scope);
    assert.equal(result.rows[0].quantity, '9007199254740993.000001');
    assert.equal(result.rows[0].value, '9007199254740993.000');
    assert.equal(result.rows[0].locationId, null);
    assert.equal('storeId' in result.rows[0], false);
    const missing = decodeInventoryPage(payload({ data: [balance({ product_id: undefined, qty_on_hand_decimal: null, avg_cost: null, stock_value: null, valuation_status: 'incomplete', valuation_issue: 'quantity_and_cost_unavailable', stock_status: 'unknown', stock_status_reason: 'quantity_unavailable' })] }), scope);
    assert.equal(missing.rows[0].quantity, null);
    assert.equal(missing.rows[0].productId, null);
    const zero = decodeInventoryPage(payload({ data: [balance({ qty_on_hand_decimal: '0', avg_cost: '0', stock_value: '0.000', stock_status: 'out' })] }), scope);
    assert.equal(zero.rows[0].quantity, '0');
    assert.equal(zero.rows[0].value, '0.000');
});
test('stock projection refuses malformed exact values, contradictory availability, wrong scope and incomplete pagination', () => {
    for (const row of [balance({ qty_on_hand_decimal: 1 }), balance({ avg_cost: '1e2' }), balance({ stock_value: null }), balance({ valuation_status: 'incomplete' }), balance({ stock_status: 'unknown', stock_status_reason: null }), balance({ qty_on_hand_decimal: '0', stock_status: 'healthy' }), balance({ stock_status: 'out' }), balance({ store_id: org }), balance({ organization_id: store })])
        assert.throws(() => decodeInventoryPage(payload({ data: [row] }), scope));
    assert.throws(() => decodeInventoryPage(payload({ data: [balance(), balance()], pagination: { total: 2, page: 1, limit: 10, totalPages: 1 } }), scope));
    for (const pagination of [{ total: 11, page: 1, limit: 10, totalPages: 2 }, { total: 1, page: 2, limit: 10, totalPages: 1 }, { total: 1, page: 1, limit: 100, totalPages: 1 }])
        assert.throws(() => decodeInventoryPage(payload({ pagination }), scope));
    assert.throws(() => decodeInventoryPage(payload({ valuation: { currency: null, fractionDigits: 3, rounding: 'per_balance_half_away_from_zero' } }), scope));
});
test('stock adapter maps the exact source route and rejects stale or foreign workspace reads', async () => {
    const requests: string[] = [];
    let identity = { ...scope };
    const adapter = createHardwareReadAdapter({ enabled: true, getIdentity: () => identity, getSession: async () => session, transport: async (request) => { requests.push(request.url); return { status: 200, body: JSON.stringify(payload()) }; } });
    await assert.rejects(adapter.getHardwareInventoryBalances(org));
    assert.equal(requests.length, 0);
    assert.equal((await adapter.getHardwareInventoryBalances(store)).rows[0].averageCost, '1.000');
    assert.deepEqual(requests, [path]);
    const stale = createHardwareReadAdapter({ enabled: true, getIdentity: () => identity, getSession: async () => session, transport: async () => { identity = { ...scope, revision: 2 }; return { status: 200, body: JSON.stringify(payload()) }; } });
    await assert.rejects(stale.getHardwareInventoryBalances(store));
});
test('one stock read consumes the check and refuses another view, bad currency and expiry', async () => {
    const calls: string[] = [];
    let time = 1000, body = payload();
    const check = createConnectionCheck({ now: () => time, signIn: async () => session, transport: async (request) => { calls.push(request.url); return { status: 200, body: JSON.stringify(request.url === path ? body : startup()) }; } });
    await check.signIn('owner@example.invalid', 'fixture', true);
    await check.inventory(store);
    assert.deepEqual(calls, ['/api/startup-context', path]);
    await assert.rejects(check.products(store));
    await assert.rejects(check.inventory(store));
    body = payload({ valuation: { currency: 'USD', fractionDigits: 2, rounding: 'per_balance_half_away_from_zero' } });
    await check.signIn('owner@example.invalid', 'fixture', true);
    await assert.rejects(check.inventory(store), /currency/);
    await assert.rejects(check.inventory(store));
    await check.signIn('owner@example.invalid', 'fixture', true);
    time = 300000;
    const count = calls.length;
    await assert.rejects(check.inventory(store));
    assert.equal(calls.length, count);
});
test('only stock-balance first-page GET passes the browser/server boundary; writes and other inventory routes stay blocked', async () => {
    assert.ok(allowedReadPath(path));
    for (const p of [path.replace('page=1', 'page=2'), path + '&locationId=' + org, path.replace('/balances', '/movements'), path.replace('/balances', '/post-stock'), path + '&storeId=' + store])
        assert.equal(allowedReadPath(p), false);
    let calls = 0;
    const input = { method: 'GET', path, authorization: 'Bearer fixture-token', apiOrigin: hardwareTargets.apiOrigin };
    const fetcher: typeof fetch = async (url, options) => { calls++; assert.equal(url, hardwareTargets.apiOrigin + path); assert.equal(options?.method, 'GET'); return new Response(JSON.stringify(payload()), { headers: { 'Content-Type': 'application/json' } }); };
    assert.equal((await proxyRead({ ...input, method: 'POST' }, fetcher)).status, 405);
    assert.equal(calls, 0);
    assert.equal((await proxyRead(input, fetcher)).status, 200);
    assert.equal(calls, 1);
});
test('read-only stock view escapes names and retains unknown versus zero without calculating page totals', () => {
    const page = decodeInventoryPage(payload({ data: [balance({ product_name: '<img src=x onerror=alert(1)>', qty_on_hand_decimal: null, stock_value: null, valuation_status: 'incomplete', valuation_issue: 'quantity_unavailable', stock_status: 'unknown', stock_status_reason: 'quantity_unavailable' })] }), scope);
    const html = connectionResults({ kind: 'inventory', data: page }, 'Fixture', startup().stores[0]);
    assert.ok(html.includes('&lt;img'));
    assert.equal(html.includes('<img'), false);
    assert.ok(html.includes('Unknown'));
    assert.ok(html.includes('Unavailable'));
    assert.ok(html.includes('not product totals'));
    assert.equal(html.includes('data-business-action'), false);
});
