import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proxyRead } from '../server/readOnlyProxy.ts';
import { hardwareTargets } from '../src/integration/connectionConfig.ts';
import { decodeSaleReceipt } from '../src/integration/saleReceiptRead.ts';

const user = '11111111-1111-4111-8111-111111111111';
const org = '22222222-2222-4222-8222-222222222222';
const store = '33333333-3333-4333-8333-333333333333';
const sale = '44444444-4444-4444-8444-444444444444';
const path = `/api/hardware/sales/invoices?storeId=${store}&saleId=${sale}`;
const input = { method: 'GET', path, authorization: 'Bearer fixture-token', apiOrigin: hardwareTargets.apiOrigin };
const row = { id: sale, store_id: store, reference: 'FIXTURE-1', status: 'completed', payment_type: 'cash', grand_total: '1.125' };
function fixture(role: string, receipt: unknown) {
    const paths: string[] = [];
    const fetcher: typeof fetch = async (url, options) => {
        assert.equal(options?.method, 'GET');
        const target = new URL(String(url));
        paths.push(target.pathname + target.search);
        if (target.pathname === '/api/startup-context')
            return Response.json({
                user: { id: user }, profile: { id: user, organization_id: org, is_active: true, role },
                organization: { id: org, name: 'Fixture' },
                stores: [{ id: store, organization_id: org, name: 'Fixture Kuwait', business_type: 'hardware', currency: 'KWD' }],
            });
        return Response.json(receipt);
    };
    return { paths, fetcher };
}
test('receipt read verifies the store and exposes only the selected sale summary', async () => {
    const f = fixture('owner', { success: true, sale: row, customer: { email: 'private' }, payments: [{ terminal_reference: 'private' }] });
    const result = await proxyRead(input, f.fetcher);
    assert.equal(result.status, 200);
    assert.deepEqual(f.paths, ['/api/startup-context', `/api/hardware/sales/${sale}/receipt?storeId=${store}`]);
    assert.deepEqual(decodeSaleReceipt(JSON.parse(result.body), store, sale),
        { id: sale, storeId: store, reference: 'FIXTURE-1', status: 'completed', tender: 'cash', total: '1.125' });
    assert.doesNotMatch(result.body, /private/);
});
test('receipt read refuses wrong scope, fallback, unauthorized roles and ambiguous selectors', async () => {
    const staff = fixture('cashier', {});
    assert.equal((await proxyRead(input, staff.fetcher)).status, 403);
    assert.deepEqual(staff.paths, ['/api/startup-context']);
    for (const body of [{ success: true, sale: { ...row, store_id: org } }, { success: true, sale: { ...row, id: org } }, { success: true, sale: row, demoFallback: true }]) {
        assert.equal((await proxyRead(input, fixture('owner', body).fetcher)).status, 502);
    }
    assert.equal((await proxyRead({ ...input, path: path + '&saleId=' + org }, async () => assert.fail('Ambiguous selector reached upstream'))).status, 404);
});
