import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectPublicConnection } from '../src/integration/publicConnection.ts';
const candidate = { apiOrigin: 'https://api.example.invalid', authProjectUrl: 'https://auth.example.invalid', frontendOrigin: 'https://hardware.example.invalid', callbackUrl: 'https://hardware.example.invalid/callback', recoveryUrl: 'https://hardware.example.invalid/recovery', transportMode: 'cors' as const, browserKeyConfigured: true };
test('all values being supplied cannot enable live auth, API or posting', () => { const state = inspectPublicConnection(candidate); assert.equal(state.publicValuesProvided, true); assert.equal(state.liveSignInEnabled, false); assert.equal(state.liveApiEnabled, false); assert.equal(state.transactionPostingEnabled, false); });
test('public connection check rejects credentials, HTTP origins and foreign redirects', () => { for (const patch of [{ apiOrigin: 'http://api.example.invalid' }, { apiOrigin: 'https://user:password@api.example.invalid' }, { apiOrigin: 'https://api.example.invalid/path?token=value' }, { callbackUrl: 'https://other.example.invalid/callback' }, { recoveryUrl: 'javascript:alert(1)' }])
    assert.ok(inspectPublicConnection({ ...candidate, ...patch }).missing.length > 0); });
test('empty candidate lists public configuration gaps without reading environment or key values', () => { const result = inspectPublicConnection({}); assert.equal(result.missing.length, 7); assert.equal('clientKey' in result, false); });
