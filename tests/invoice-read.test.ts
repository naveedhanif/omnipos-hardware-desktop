import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeInvoicePage } from '../src/integration/invoiceRead.ts';
import { createConnectionCheck } from '../src/integration/connectionCheck.ts';
import { createHardwareReadAdapter } from '../src/integration/hardwareReadAdapter.ts';
import { allowedReadPath } from '../src/integration/readBoundary.ts';
import { connectionResults } from '../src/ui/connectionResults.ts';
const user = '11111111-1111-4111-8111-111111111111', org = '22222222-2222-4222-8222-222222222222', store = '33333333-3333-4333-8333-333333333333';
const path = `/api/hardware/sales/invoices?storeId=${store}&page=1&limit=10`;
const row = () => ({ id: '44444444-4444-4444-8444-444444444444', receipt_number: 'FIXTURE-001', sale_date: '2026-11-03T10:00:00Z', status: 'completed', tender_type: 'account', subtotal: '1.125', tax_total: null, grand_total: 1.125, customer: { private: 'unused' } });
const body = () => ({ data: [row()], count: 1, page: 1, limit: 10 });
const startup = (role = 'OWNER') => ({ user: { id: user }, profile: { id: user, organization_id: org, role, is_active: true }, organization: { id: org, name: 'Fixture' }, stores: [{ id: store, organization_id: org, name: 'Fixture store', business_type: 'hardware', currency: 'KWD' }] });
const session = { userId: user, accessToken: 'fixture-token', expiresAt: 200000 };
test('invoice subset preserves recorded amounts, omits customer details and rejects fallback or inconsistent pages', () => {
    const page = decodeInvoicePage(body());
    assert.equal(page.rows[0].subtotal, '1.125');
    assert.equal(page.rows[0].tax, null);
    assert.equal(page.rows[0].total, '1.125');
    assert.equal('customer' in page.rows[0], false);
    for (const patch of [{ demoFallback: true }, { success: false }, { count: null }, { count: 20 }, { page: 2 }, { limit: 100 }, { data: [row(), row()], count: 2 }, { data: [{ ...row(), grand_total: 'NaN' }] }, { data: [{ ...row(), sale_date: 'not-a-date' }] }, { data: [{ ...row(), status: 'voided' }] }])
        assert.throws(() => decodeInvoicePage({ ...body(), ...patch }));
});
test('invoice adapter requests only the exact scoped GET and refuses a different store', async () => {
    const seen: string[] = [];
    const adapter = createHardwareReadAdapter({ enabled: true, getIdentity: () => ({ userId: user, organizationId: org, storeId: store, revision: 1 }), getSession: async () => session, transport: async (request) => { seen.push(request.url); return { status: 200, body: JSON.stringify(body()) }; } });
    await assert.rejects(adapter.getHardwareInvoices(org));
    assert.equal(seen.length, 0);
    await adapter.getHardwareInvoices(store);
    assert.deepEqual(seen, [path]);
    assert.ok(allowedReadPath(path));
    assert.equal(allowedReadPath(path.replace('/invoices', '/refund')), false);
    assert.equal(allowedReadPath(path + '&search=all'), false);
});
test('invoice read requires owner/admin, consumes one check and cannot fall back to products', async () => {
    for (const role of ['MANAGER', 'CASHIER', 'OWNER', 'admin']) {
        let reads = 0;
        const check = createConnectionCheck({ now: () => 1000, signIn: async () => session, transport: async (request) => { reads++; return { status: 200, body: JSON.stringify(request.url.includes('/invoices') ? body() : startup(role)) }; } });
        const result = await check.signIn('owner@example.invalid', 'fixture', true);
        if (['OWNER', 'admin'].includes(role)) {
            assert.equal(result.canReadInvoices, true);
            await check.invoices(store);
            assert.equal(reads, 2);
            await assert.rejects(check.products(store));
        }
        else {
            assert.equal(result.canReadInvoices, false);
            await assert.rejects(check.invoices(store), /Owner/);
            assert.equal(reads, 1);
        }
    }
});
test('invoice results are escaped, read-only and do not present a recomputed financial total', () => {
    const page = decodeInvoicePage({ ...body(), data: [{ ...row(), receipt_number: '<script>fixture</script>' }] });
    const html = connectionResults({ kind: 'invoices', data: page }, 'Fixture', startup().stores[0]);
    assert.ok(html.includes('&lt;script&gt;'));
    assert.equal(html.includes('<script>'), false);
    assert.ok(html.includes('no net revenue'));
    assert.ok(html.includes('Unavailable'));
    assert.equal(html.includes('data-business-action'), false);
});
