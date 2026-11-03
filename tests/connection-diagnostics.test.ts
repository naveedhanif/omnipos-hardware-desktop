import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectionError } from '../src/ui/connectionError.ts';
import { HardwareReadError } from '../src/integration/contracts.ts';
import { proxyRead, upstreamReadTimeoutMs } from '../server/readOnlyProxy.ts';
import { hardwareTargets } from '../src/integration/connectionConfig.ts';
test('read timeout is distinct from network refusal, with one attempt and no raw exception text', async () => {
    assert.equal(upstreamReadTimeoutMs, 60000);
    let calls = 0;
    const input = { method: 'GET', path: '/api/startup-context', authorization: 'Bearer fixture-token', apiOrigin: hardwareTargets.apiOrigin };
    const result = await proxyRead(input, async () => { calls++; throw new DOMException('private exception detail', 'TimeoutError'); });
    assert.equal(calls, 1);
    assert.equal(result.status, 502);
    assert.equal(JSON.parse(result.body).code, 'UPSTREAM_READ_TIMEOUT');
    assert.equal(result.body.includes('private exception'), false);
    const other = await proxyRead(input, async () => { throw new Error('private network text'); });
    assert.equal(JSON.parse(other.body).code, 'UPSTREAM_READ_UNCONFIRMED');
});
test('UI diagnostics expose safe status/code but suppress server text and unknown errors', () => {
    const error = new HardwareReadError('http', 'private backend text', 502, 'UPSTREAM_READ_TIMEOUT', '44444444-4444-4444-8444-444444444444');
    const text = connectionError(error);
    assert.ok(text.includes('60 seconds'));
    assert.ok(text.includes('HTTP 502'));
    assert.ok(text.includes('UPSTREAM_READ_TIMEOUT'));
    assert.ok(text.includes('44444444-4444-4444-8444-444444444444'));
    assert.equal(text.includes('private backend text'), false);
    assert.equal(connectionError(new Error('secret-token-value')).includes('secret-token-value'), false);
    assert.ok(connectionError(new HardwareReadError('unauthenticated', 'raw', 401)).includes('HTTP 401'));
    assert.ok(connectionError(new HardwareReadError('forbidden', 'raw', 403)).includes('refused access'));
});

test('active till projection rejects fallback and foreign stores and hides till details', async () => {
    const storeId = '33333333-3333-4333-8333-333333333333';
    const input = { method: 'GET', path: '/api/hardware/till/active?storeId=' + storeId, authorization: 'Bearer fixture-token', apiOrigin: hardwareTargets.apiOrigin };
    const session = { id: '44444444-4444-4444-8444-444444444444', store_id: storeId, status: 'open', opening_float: 100 };
    const read = (payload: unknown) => proxyRead(input, async () => Response.json(payload));
    assert.deepEqual(await read({ session, demoFallback: false }), { status: 200, body: '{"open":true}' });
    assert.deepEqual(await read({ session: null, demoFallback: false }), { status: 200, body: '{"open":false}' });
    assert.equal((await read({ session, demoFallback: true })).status, 502);
    assert.equal((await read({ session: { ...session, store_id: 'foreign' }, demoFallback: false })).status, 502);
    assert.equal((await proxyRead({ ...input, path: input.path + '&storeId=' + storeId }, async () => {
        assert.fail('Duplicate scope must be rejected before forwarding');
    })).status, 404);
});
