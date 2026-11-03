import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReadOnlyWorkspace, workspaceLifetimeMs } from '../src/integration/readOnlyWorkspace.ts';
import { allowedReadPath } from '../src/integration/readBoundary.ts';
import { readWindow } from '../src/integration/readWindow.ts';
import { decodeInventoryPage } from '../src/integration/inventoryRead.ts';
import { decodeInvoicePage } from '../src/integration/invoiceRead.ts';
import { connectionResults } from '../src/ui/connectionResults.ts';
const user = '11111111-1111-4111-8111-111111111111', org = '22222222-2222-4222-8222-222222222222', store = '33333333-3333-4333-8333-333333333333', other = '44444444-4444-4444-8444-444444444444';
const startup = () => ({ user: { id: user }, profile: { id: user, organization_id: org, role: 'OWNER', is_active: true }, organization: { id: org, name: 'Fixture company' }, stores: [store, other].map((id, index) => ({ id, organization_id: org, name: 'Fixture ' + index, business_type: 'hardware', currency: 'KWD' })) });
const product = (storeId = store) => ({ id: '55555555-5555-4555-8555-555555555555', store_id: storeId, name: 'Fixture drill', sku: 'FIXTURE', barcode: null, cost_price: 1, sell_price: 2, stock_qty: null, uom: 'pcs' });
const balance = () => ({ id: '66666666-6666-4666-8666-666666666666', product_id: null, product_name: 'Fixture', sku: 'FIXTURE', uom: 'pcs', location_id: null, location_name: null, bin_location: null, qty_on_hand_decimal: '0', avg_cost: '1.125', stock_value: '0.000', valuation_status: 'valued', valuation_issue: null, stock_status: 'out', stock_status_reason: null });
const invoice = () => ({ id: '77777777-7777-4777-8777-777777777777', receipt_number: 'FIXTURE-001', sale_date: '2026-11-03T10:00:00Z', status: 'completed', tender_type: 'cash', subtotal: '1.125', tax_total: null, grand_total: '1.125' });
const bodyFor = (path: string) => {
    const url = new URL(path, 'https://fixture.invalid'), page = Number(url.searchParams.get('page')), storeId = url.searchParams.get('storeId')!;
    const count = page === 2 ? 11 : 1;
    if (url.pathname.includes('inventory'))
        return { success: true, data: [balance()], pagination: { total: count, page, limit: 10, totalPages: Math.ceil(count / 10) }, valuation: { currency: 'KWD', fractionDigits: 3, rounding: 'per_balance_half_away_from_zero' } };
    if (url.pathname.includes('invoices'))
        return { data: [invoice()], count, page, limit: 10 };
    return { success: true, products: [product(storeId)], total: count, page, limit: 10, totalPages: Math.ceil(count / 10) };
};
const response = (body: unknown) => ({ status: 200, body: JSON.stringify(body) });
function fixture() {
    let now = 1000, context = startup();
    const calls: string[] = [];
    const model = createReadOnlyWorkspace({ now: () => now, signIn: async () => ({ userId: user, accessToken: 'fixture-token', expiresAt: now + 3600000 }), transport: async (req) => { calls.push(req.url); return response(req.url === '/api/startup-context' ? context : bodyFor(req.url)); } });
    return { model, calls, setTime: (t: number) => now = t, setContext: (c: ReturnType<typeof startup>) => context = c };
}
test('workspace stays inert before consent/store selection and exposes no credential in summary', async () => {
    const { model, calls } = fixture();
    assert.equal(model.summary(), null);
    await assert.rejects(model.signIn('fixture@example.invalid', 'fixture', false));
    assert.equal(calls.length, 0);
    await model.signIn('fixture@example.invalid', 'fixture', true);
    await assert.rejects(model.read('products'));
    assert.deepEqual(calls, ['/api/startup-context']);
    assert.throws(() => model.selectStore(org));
    model.selectStore(store);
    assert.equal(model.summary()?.storeId, store);
    assert.equal(JSON.stringify(model.summary()).includes('fixture-token'), false);
    model.selectStore(null);
    assert.equal(model.summary()?.storeId, null);
    await assert.rejects(model.read('products'));
    assert.equal(calls.length, 1);
});
test('manual view/page/search reads each recheck startup and reuse only a memory session', async () => {
    const { model, calls } = fixture();
    await model.signIn('fixture@example.invalid', 'fixture', true);
    model.selectStore(store);
    for (const view of ['products', 'inventory', 'invoices'] as const) {
        const result = await model.read(view, { page: 2, search: 'Drill 18V' });
        assert.equal(result.kind, view);
        assert.equal(result.data.page, 2);
        assert.equal(result.data.total, 11);
    }
    assert.equal(calls.length, 7);
    for (let i = 1; i < calls.length; i += 2) {
        assert.equal(calls[i], '/api/startup-context');
        assert.ok(calls[i + 1].includes('page=2'));
        assert.ok(calls[i + 1].includes('search=Drill+18V'));
        assert.ok(allowedReadPath(calls[i + 1]));
    }
    assert.equal(model.summary()?.storeId, store);
});
test('every read fails closed on revoked activity, changed company/store type or invoice role', async () => {
    for (const mutate of [
        (c: ReturnType<typeof startup>) => ({ ...c, profile: { ...c.profile, is_active: false } }),
        (c: ReturnType<typeof startup>) => ({ ...c, organization: { ...c.organization, id: other }, profile: { ...c.profile, organization_id: other }, stores: c.stores.map(s => ({ ...s, organization_id: other })) }),
        (c: ReturnType<typeof startup>) => ({ ...c, stores: c.stores.map(s => ({ ...s, business_type: 'grocery' })) }),
        (c: ReturnType<typeof startup>) => ({ ...c, stores: c.stores.filter(s => s.id !== store) }),
        (c: ReturnType<typeof startup>) => ({ ...c, profile: { ...c.profile, role: 'CASHIER' } }),
    ]) {
        const { model, calls, setContext } = fixture();
        await model.signIn('fixture@example.invalid', 'fixture', true);
        model.selectStore(store);
        setContext(mutate(startup()));
        await assert.rejects(model.read('invoices'));
        assert.equal(calls.length, 2);
        assert.equal(model.summary(), null);
    }
});
test('store switch discards a late response without clearing the new store/session', async () => {
    let release!: (value: {
        status: number;
        body: string;
    }) => void;
    let productReads = 0;
    const model = createReadOnlyWorkspace({ now: () => 1000, signIn: async () => ({ userId: user, accessToken: 'fixture-token', expiresAt: 9999999 }), transport: async (req) => {
            if (req.url === '/api/startup-context')
                return response(startup());
            productReads++;
            if (productReads === 1)
                return new Promise(r => release = r);
            return response(bodyFor(req.url));
        } });
    await model.signIn('fixture@example.invalid', 'fixture', true);
    model.selectStore(store);
    const old = model.read('products');
    await new Promise(r => setImmediate(r));
    model.selectStore(other);
    const current = await model.read('products');
    release(response(bodyFor(`/api/hardware/products?storeId=${store}&page=1&limit=10`)));
    await assert.rejects(old);
    assert.equal(current.kind, 'products');
    assert.equal(model.summary()?.storeId, other);
});
test('15 minute absolute lifetime and provider expiry both stop reads without refresh/network calls', async () => {
    const f = fixture();
    await f.model.signIn('fixture@example.invalid', 'fixture', true);
    assert.equal(f.model.summary()?.expiresAt, 1000 + workspaceLifetimeMs);
    f.model.selectStore(store);
    f.setTime(1001 + workspaceLifetimeMs);
    await assert.rejects(f.model.read('products'));
    assert.equal(f.calls.length, 1);
    assert.equal(f.model.summary(), null);
    let now = 1000;
    const model = createReadOnlyWorkspace({ now: () => now, signIn: async () => ({ userId: user, accessToken: 'fixture-token', expiresAt: 2000 }), transport: async () => response(startup()) });
    await model.signIn('fixture@example.invalid', 'fixture', true);
    assert.equal(model.summary()?.expiresAt, 2000);
    now = 2001;
    assert.equal(model.summary(), null);
});
test('in-flight duplicate read and invalid filters do not send extra requests; clear cancels the attempt', async () => {
    let release!: (value: {
        status: number;
        body: string;
    }) => void;
    let calls = 0;
    const model = createReadOnlyWorkspace({ now: () => 1000, signIn: async () => ({ userId: user, accessToken: 'fixture-token', expiresAt: 9999999 }), transport: async () => { calls++; return calls === 1 ? response(startup()) : new Promise(r => release = r); } });
    await model.signIn('fixture@example.invalid', 'fixture', true);
    model.selectStore(store);
    await assert.rejects(model.read('products', { page: 0 }));
    await assert.rejects(model.read('products', { search: 'x),or=(private)' }));
    assert.equal(calls, 1);
    const work = model.read('products');
    await new Promise(r => setImmediate(r));
    await assert.rejects(model.read('inventory'));
    assert.equal(calls, 2);
    model.clear();
    release(response(startup()));
    await assert.rejects(work);
    assert.equal(calls, 2);
    assert.equal(model.summary(), null);
});
test('bounded GET policy allows manual pages/search while refusing filters, duplication and query syntax', () => {
    for (const path of ['/api/hardware/products', '/api/hardware/inventory/balances', '/api/hardware/sales/invoices']) {
        assert.ok(allowedReadPath(`${path}?storeId=${store}&page=2&limit=10&search=Drill+18V`));
        for (const suffix of ['page=0&limit=10', 'page=10001&limit=10', 'page=01&limit=10', 'page=2&limit=100', 'page=2&limit=10&search=', 'page=2&limit=10&search=x%2Cy', 'page=2&limit=10&search=a&search=b', 'page=2&limit=10&organizationId=' + org])
            assert.equal(allowedReadPath(`${path}?storeId=${store}&${suffix}`), false);
    }
    assert.deepEqual(readWindow({ search: '  Drill 18V  ', page: 3 }), { page: 3, search: 'Drill 18V' });
});
test('later-page decoders preserve source metadata and exact balances, refusing wrong-page answers', () => {
    const scope = { userId: user, organizationId: org, storeId: store, revision: 1 };
    const inventory = bodyFor(`/api/hardware/inventory/balances?storeId=${store}&page=2&limit=10`);
    const inv = decodeInventoryPage(inventory, scope, 2);
    assert.equal(inv.page, 2);
    assert.equal(inv.rows[0].quantity, '0');
    assert.equal(inv.rows[0].value, '0.000');
    assert.throws(() => decodeInventoryPage(inventory, scope, 1));
    const invoices = bodyFor(`/api/hardware/sales/invoices?storeId=${store}&page=2&limit=10`);
    const page = decodeInvoicePage(invoices, 2);
    assert.equal(page.page, 2);
    assert.equal(page.totalPages, 2);
    assert.throws(() => decodeInvoicePage(invoices, 1));
    const html = connectionResults({ kind: 'inventory', data: inv }, 'Fixture', startup().stores[0], true);
    assert.ok(html.includes('Page 2'));
    assert.equal(html.includes('Start a new check'), false);
});
test('logout during pending authentication cannot restore a session or start a startup request', async () => {
    let release!: (s: {
        userId: string;
        accessToken: string;
        expiresAt: number;
    }) => void, reads = 0;
    const model = createReadOnlyWorkspace({ now: () => 1000, signIn: () => new Promise(r => release = r), transport: async () => { reads++; return response(startup()); } });
    const pending = model.signIn('fixture@example.invalid', 'fixture', true);
    assert.equal(model.summary(), null);
    model.clear();
    release({ userId: user, accessToken: 'fixture-token', expiresAt: 9999999 });
    await assert.rejects(pending);
    assert.equal(model.summary(), null);
    assert.equal(reads, 0);
});
test('failed data read clears the workspace with no retry or fabricated result', async () => {
    let reads = 0;
    const model = createReadOnlyWorkspace({ now: () => 1000, signIn: async () => ({ userId: user, accessToken: 'fixture-token', expiresAt: 9999999 }), transport: async (req) => { reads++; return req.url === '/api/startup-context' ? response(startup()) : { status: 503, body: JSON.stringify({ code: 'SERVICE_UNAVAILABLE' }) }; } });
    await model.signIn('fixture@example.invalid', 'fixture', true);
    model.selectStore(store);
    await assert.rejects(model.read('products'));
    assert.equal(reads, 3);
    assert.equal(model.summary(), null);
    await assert.rejects(model.read('products'));
    assert.equal(reads, 3);
});
