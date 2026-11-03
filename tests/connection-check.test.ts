import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectConnectionConfig, hardwareTargets } from '../src/integration/connectionConfig.ts';
import { allowedReadPath, limitedText } from '../src/integration/readBoundary.ts';
import { createConnectionCheck, type CheckSession } from '../src/integration/connectionCheck.ts';
import { createBrowserCheckPorts } from '../src/integration/browserCheckPorts.ts';
import { proxyRead, readOnlyHandler } from '../server/readOnlyProxy.ts';
import type { IncomingMessage, ServerResponse } from 'node:http';
const user = '11111111-1111-4111-8111-111111111111', org = '22222222-2222-4222-8222-222222222222', store = '33333333-3333-4333-8333-333333333333';
const path = `/api/hardware/products?storeId=${store}&page=1&limit=10`;
const env = { VITE_OMNIPOS_API_ORIGIN: hardwareTargets.apiOrigin, VITE_SUPABASE_URL: hardwareTargets.authOrigin, VITE_SUPABASE_ANON_KEY: 'sb_publishable_fixtureOnly0123456789', VITE_HARDWARE_FRONTEND_ORIGIN: hardwareTargets.frontendOrigin + '/', VITE_HARDWARE_TRANSPORT_MODE: 'same-origin-proxy' };
const startup = () => ({ user: { id: user }, profile: { id: user, organization_id: org, role: 'OWNER', is_active: true }, organization: { id: org, name: 'Fixture company' }, stores: [{ id: store, organization_id: org, name: 'Fixture store', business_type: 'hardware', currency: 'KWD' }] });
const page = () => ({ success: true, products: [{ id: '55555555-5555-4555-8555-555555555555', store_id: store, name: 'Fixture product', sku: null, barcode: null, cost_price: null, sell_price: 2, stock_qty: null, uom: 'pcs' }], total: 1, page: 1, limit: 10, totalPages: 1 });
const session: CheckSession = { userId: user, accessToken: 'fixture-token', expiresAt: 200000 };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
test('connection configuration rejects secret keys, foreign targets and wrong frontend; no enable flag', () => {
    assert.ok(inspectConnectionConfig(env, hardwareTargets.frontendOrigin).config);
    const jwt = (role: string) => `${btoa('{}').replace(/=/g, '')}.${btoa(JSON.stringify({ role, ref: 'esjbplouepusbzrrkfvs' })).replace(/=/g, '')}.signature`;
    assert.ok(inspectConnectionConfig({ ...env, VITE_SUPABASE_ANON_KEY: jwt('anon') }, hardwareTargets.frontendOrigin).config);
    for (const patch of [{ VITE_SUPABASE_ANON_KEY: 'sb_secret_fixture' }, { VITE_SUPABASE_ANON_KEY: jwt('service_role') }, { VITE_OMNIPOS_API_ORIGIN: 'https://foreign.invalid' }, { VITE_HARDWARE_TRANSPORT_MODE: hardwareTargets.frontendOrigin }])
        assert.equal(inspectConnectionConfig({ ...env, ...patch }, hardwareTargets.frontendOrigin).config, null);
    assert.equal(inspectConnectionConfig(env, 'https://preview.invalid').config, null);
    assert.equal(inspectConnectionConfig({}, hardwareTargets.frontendOrigin).config, null);
});
test('exact read boundary refuses writes/extra query paths and limits response bytes', async () => {
    assert.ok(allowedReadPath(path));
    assert.ok(allowedReadPath('/api/startup-context'));
    for (const p of ['/api/hardware/seed-defaults', '//foreign.invalid/api/startup-context', '/api/startup-context?x=1', path + '&storeId=' + store, path.replace('limit=10', 'limit=100'), path + '&unsupported=all'])
        assert.equal(allowedReadPath(p), false);
    await assert.rejects(limitedText(new Response('123456'), 5));
});
test('proxy never forwards writes, unknown paths, missing tokens or a changed target', async () => {
    let calls = 0;
    const fetcher: typeof fetch = async () => { calls++; return response({}); };
    const input = { method: 'GET', path, authorization: 'Bearer fixture-token', apiOrigin: hardwareTargets.apiOrigin };
    for (const patch of [{ method: 'POST' }, { method: 'DELETE' }, { path: '/api/hardware/bootstrap' }, { authorization: undefined }, { apiOrigin: 'https://foreign.invalid' }])
        assert.notEqual((await proxyRead({ ...input, ...patch }, fetcher)).status, 200);
    assert.equal(calls, 0);
    const result = await proxyRead(input, async (url, options) => { calls++; assert.equal(url, hardwareTargets.apiOrigin + path); assert.equal(options?.redirect, 'error'); assert.equal(options?.cache, 'no-store'); assert.deepEqual(options?.headers, { Authorization: 'Bearer fixture-token', Accept: 'application/json' }); return response(page()); });
    assert.equal(result.status, 200);
    assert.equal(calls, 1);
});
test('proxy sanitizes upstream errors and refuses HTML, redirects and malformed JSON without retry', async () => {
    const input = { method: 'GET', path, authorization: 'Bearer fixture-token', apiOrigin: hardwareTargets.apiOrigin };
    for (const body of [response({ error: 'private upstream detail' }, 403), new Response('<html>oops</html>', { headers: { 'Content-Type': 'text/html' } }), new Response('invalid', { headers: { 'Content-Type': 'application/json' } }), new Response('', { status: 302, headers: { Location: 'https://foreign.invalid' } })]) {
        let calls = 0;
        const result = await proxyRead(input, async () => { calls++; return body; });
        assert.notEqual(result.status, 200);
        assert.equal(result.body.includes('private upstream'), false);
        assert.equal(calls, 1);
    }
});
test('function returns no-store headers and rejects POST before any network request', async () => {
    const headers = new Map<string, string>();
    let body = '';
    const res = { setHeader: (k: string, v: string) => headers.set(k, v), statusCode: 0, end: (v: string) => { body = v; } };
    await readOnlyHandler({ method: 'POST', url: '/api/startup-context', headers: {} } as IncomingMessage, res as unknown as ServerResponse);
    assert.equal(res.statusCode, 405);
    assert.equal(headers.get('Allow'), 'GET');
    assert.equal(headers.get('Vercel-CDN-Cache-Control'), 'no-store');
    assert.equal(headers.get('Cache-Control'), 'private, no-store, max-age=0');
    assert.ok(body.includes('READ_ONLY_METHOD'));
});
test('check requires consent, reads startup first, rejects foreign stores and consumes only one product read', async () => {
    const calls: string[] = [];
    let auth = 0;
    const check = createConnectionCheck({ now: () => 1000, signIn: async () => { auth++; return session; }, transport: async (req) => { calls.push(req.url); return { status: 200, body: JSON.stringify(req.url.includes('products') ? page() : startup()) }; } });
    await assert.rejects(check.signIn('fixture@example.invalid', 'fixture-password', false));
    assert.equal(auth, 0);
    await assert.rejects(check.products(store));
    await check.signIn('fixture@example.invalid', 'fixture-password', true);
    assert.deepEqual(calls, ['/api/startup-context']);
    await assert.rejects(check.products(org));
    assert.equal(calls.length, 1);
    const result = await check.products(store);
    assert.equal(result.products[0].stock_qty, null);
    assert.deepEqual(calls, ['/api/startup-context', path]);
    await assert.rejects(check.products(store));
    assert.equal(auth, 1);
});
test('inactive/mismatched startup or expired auth cannot result in product reads', async () => {
    for (const context of [{ ...startup(), profile: { ...startup().profile, is_active: false } }, { ...startup(), user: { id: org } }]) {
        let reads = 0;
        const check = createConnectionCheck({ now: () => 1000, signIn: async () => session, transport: async () => { reads++; return { status: 200, body: JSON.stringify(context) }; } });
        await assert.rejects(check.signIn('a@example.invalid', 'fixture', true));
        await assert.rejects(check.products(store));
        assert.equal(reads, 1);
    }
    let time = 1000, reads = 0;
    const check = createConnectionCheck({ now: () => time, signIn: async () => session, transport: async () => { reads++; return { status: 200, body: JSON.stringify(startup()) }; } });
    await check.signIn('a@example.invalid', 'fixture', true);
    time = 300000;
    await assert.rejects(check.products(store));
    assert.equal(reads, 1);
});
test('clear invalidates late sign-in and product answers without restoring a session', async () => {
    let resolve!: (s: CheckSession) => void;
    const check = createConnectionCheck({ now: () => 1000, signIn: () => new Promise(r => resolve = r), transport: async () => { throw Error('must not send'); } });
    const work = check.signIn('fixture@example.invalid', 'fixture', true);
    check.clear();
    resolve(session);
    await assert.rejects(work);
    await assert.rejects(check.products(store));
    let release!: (r: {
        status: number;
        body: string;
    }) => void;
    const second = createConnectionCheck({ now: () => 1000, signIn: async () => session, transport: async (req) => req.url.includes('products') ? new Promise(r => release = r) : { status: 200, body: JSON.stringify(startup()) } });
    await second.signIn('a@example.invalid', 'fixture', true);
    const pending = second.products(store);
    await new Promise(r => setImmediate(r));
    second.clear();
    release({ status: 200, body: JSON.stringify(page()) });
    await assert.rejects(pending);
    await assert.rejects(second.products(store));
});
test('browser SDK sign-in uses one approved auth POST; no refresh/storage-backed session or provider logout is requested', async () => {
    const config = inspectConnectionConfig(env, hardwareTargets.frontendOrigin).config!;
    const calls: string[] = [];
    const ports = createBrowserCheckPorts(config, async (input, init) => {
        const url = String(input);
        calls.push(url);
        assert.equal(url, hardwareTargets.authOrigin + '/auth/v1/token?grant_type=password');
        assert.equal(init?.method, 'POST');
        assert.equal(init?.redirect, 'error');
        assert.equal(init?.credentials, 'omit');
        return response({ access_token: 'fixture-access-token', refresh_token: 'fixture-refresh-token', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: user, aud: 'authenticated', created_at: '2026-01-01T00:00:00Z' } });
    });
    const result = await ports.signIn('a@example.invalid', 'fixture-password', new AbortController().signal);
    assert.equal(result.userId, user);
    assert.equal(calls.length, 1);
    await assert.rejects(ports.transport({ method: 'GET', url: '/api/hardware/capabilities', headers: {} }));
    assert.equal(calls.length, 1);
});
test('an old product response cannot erase a newly signed-in check; failed reads do not retry', async () => {
    let release!: (r: {
        status: number;
        body: string;
    }) => void, productCalls = 0;
    const check = createConnectionCheck({ now: () => 1000, signIn: async () => session, transport: async (req) => {
            if (!req.url.includes('products'))
                return { status: 200, body: JSON.stringify(startup()) };
            productCalls++;
            if (productCalls === 1)
                return new Promise(r => release = r);
            return { status: 403, body: JSON.stringify({ code: 'FORBIDDEN' }) };
        } });
    await check.signIn('a@example.invalid', 'fixture', true);
    const old = check.products(store);
    await new Promise(r => setImmediate(r));
    await check.signIn('a@example.invalid', 'fixture', true);
    release({ status: 200, body: JSON.stringify(page()) });
    await assert.rejects(old);
    await assert.rejects(check.products(store));
    assert.equal(productCalls, 2);
    await assert.rejects(check.products(store));
    assert.equal(productCalls, 2);
});
