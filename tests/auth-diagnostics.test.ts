import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserCheckPorts } from '../src/integration/browserCheckPorts.ts';
import { inspectConnectionConfig, hardwareTargets } from '../src/integration/connectionConfig.ts';
import { AuthCheckError, projectAuthError } from '../src/integration/authCheckError.ts';
import { connectionError } from '../src/ui/connectionError.ts';
import { createConnectionCheck } from '../src/integration/connectionCheck.ts';
const user = '11111111-1111-4111-8111-111111111111';
const config = inspectConnectionConfig({ VITE_OMNIPOS_API_ORIGIN: hardwareTargets.apiOrigin, VITE_SUPABASE_URL: hardwareTargets.authOrigin, VITE_SUPABASE_ANON_KEY: 'sb_publishable_fixtureOnly0123456789', VITE_HARDWARE_FRONTEND_ORIGIN: hardwareTargets.frontendOrigin, VITE_HARDWARE_TRANSPORT_MODE: 'same-origin-proxy' }, hardwareTargets.frontendOrigin).config!;
test('actual SDK refusal preserves safe auth code/status, hides private text and starts no backend read', async () => {
    for (const [providerCode, status, expected] of [['invalid_credentials', 400, 'AUTH_INVALID_CREDENTIALS'], ['email_not_confirmed', 400, 'AUTH_EMAIL_NOT_CONFIRMED'], ['over_request_rate_limit', 429, 'AUTH_RATE_LIMITED'], ['captcha_failed', 400, 'AUTH_CAPTCHA_REQUIRED']] as const) {
        let requests = 0, authenticated = 0;
        const ports = createBrowserCheckPorts(config, async (input) => { requests++; assert.ok(String(input).endsWith('/auth/v1/token?grant_type=password')); return new Response(JSON.stringify({ code: providerCode, msg: 'private email token fixture-value' }), { status, headers: { 'Content-Type': 'application/json', 'x-supabase-api-version': '2024-01-01' } }); });
        const check = createConnectionCheck({ ...ports, onAuthenticated: () => authenticated++ });
        await assert.rejects(check.signIn('fixture@example.invalid', 'fixture-password', true), error => {
            assert.ok(error instanceof AuthCheckError);
            assert.equal(error.code, expected);
            assert.equal(error.status, status);
            const display = connectionError(error);
            assert.ok(display.includes(expected));
            assert.ok(display.includes(String(status)));
            assert.equal(display.includes('fixture-value'), false);
            assert.equal(JSON.stringify(error).includes('fixture-value'), false);
            return true;
        });
        assert.equal(requests, 1);
        assert.equal(authenticated, 0);
    }
});
test('unknown provider codes or key rejection are not misreported as a bad password', () => {
    for (const code of ['private-token-code', '__proto__']) {
        const error = projectAuthError({ status: 401, code, message: 'private email' });
        assert.equal(error.code, 'AUTH_REQUEST_REJECTED');
        assert.equal(error.providerCode, undefined);
        assert.equal(connectionError(error).includes(code), false);
    }
    assert.equal(projectAuthError({ status: 503, message: 'private' }).code, 'AUTH_PROVIDER_UNAVAILABLE');
    assert.equal(projectAuthError({}, 'timeout').code, 'AUTH_TIMEOUT');
    assert.equal(projectAuthError({}, 'network').code, 'AUTH_NETWORK_UNCONFIRMED');
});
test('successful SDK sign-in accepts provider expiry calculation and distinguishes the workspace refusal', async () => {
    const requests: string[] = [];
    let authenticated = 0;
    const ports = createBrowserCheckPorts(config, async (input) => {
        const url = String(input);
        requests.push(url);
        if (url.startsWith(config.authOrigin))
            return new Response(JSON.stringify({ access_token: 'fixture-access-token', refresh_token: 'fixture-refresh-token', token_type: 'bearer', expires_in: 3600, user: { id: user, aud: 'authenticated', created_at: '2026-01-01T00:00:00Z' } }), { headers: { 'Content-Type': 'application/json' } });
        return new Response(JSON.stringify({ code: 'UPSTREAM_READ_TIMEOUT', error: 'private response text' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    });
    const check = createConnectionCheck({ ...ports, onAuthenticated: () => authenticated++ });
    await assert.rejects(check.signIn('fixture@example.invalid', 'fixture-password', true), error => { const display = connectionError(error); assert.ok(display.includes('UPSTREAM_READ_TIMEOUT')); assert.equal(display.includes('AUTH_INVALID_CREDENTIALS'), false); assert.equal(display.includes('private response text'), false); return true; });
    assert.equal(authenticated, 1);
    assert.deepEqual(requests, [config.authOrigin + '/auth/v1/token?grant_type=password', '/api/startup-context']);
});
test('malformed session cannot announce authentication success or start workspace lookup', async () => {
    let authenticated = 0, reads = 0;
    for (const patch of [{ expiresAt: NaN }, { userId: 'not-a-uuid' }, { accessToken: 'token with spaces' }, { accessToken: 123 as unknown as string }]) {
        const check = createConnectionCheck({ signIn: async () => ({ userId: user, accessToken: 'fixture-token', expiresAt: Date.now() + 10000, ...patch }), onAuthenticated: () => authenticated++, transport: async () => { reads++; throw Error('must not read'); } });
        await assert.rejects(check.signIn('fixture@example.invalid', 'fixture', true));
    }
    assert.equal(authenticated, 0);
    assert.equal(reads, 0);
});
