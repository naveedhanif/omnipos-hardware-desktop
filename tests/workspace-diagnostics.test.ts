import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspaceDiagnostics, diagnosticText, diagnosticRecovery } from '../src/integration/workspaceDiagnostics.ts';
import { createReadOnlyWorkspace } from '../src/integration/readOnlyWorkspace.ts';
import { HardwareReadError } from '../src/integration/contracts.ts';
import { AuthCheckError, type AuthCheckCode } from '../src/integration/authCheckError.ts';
import { connectionError } from '../src/ui/connectionError.ts';
import { workspaceDiagnosticPanel } from '../src/ui/workspaceDiagnostics.ts';
const user = '11111111-1111-4111-8111-111111111111', org = '22222222-2222-4222-8222-222222222222', store = '33333333-3333-4333-8333-333333333333', id = '44444444-4444-4444-8444-444444444444';
const context = { user: { id: user }, profile: { id: user, organization_id: org, role: 'OWNER', is_active: true }, organization: { id: org, name: 'private-company' }, stores: [{ id: store, organization_id: org, name: 'private-store', business_type: 'hardware', currency: 'KWD' }] };
const body = (v: unknown) => ({ status: 200, body: JSON.stringify(v) });
const session = { userId: user, accessToken: 'private-token', expiresAt: 9999999 };
test('diagnostics stay inert and retain only one projected operation, not URLs, identities, queries or payloads', async () => {
    let calls = 0;
    const diagnostic = createWorkspaceDiagnostics({ now: () => 1000, signIn: async () => { calls++; return session; }, transport: async (req) => { calls++; return req.url === '/api/startup-context' ? body(context) : body({ success: true, data: [], count: 0, page: 1, limit: 10 }); } });
    assert.equal(diagnostic.snapshot(), null);
    const model = createReadOnlyWorkspace(diagnostic.ports);
    const auth = diagnostic.begin('signIn');
    assert.equal(calls, 0);
    await model.signIn('private-email@example.invalid', 'private-password', true);
    diagnostic.finish(auth);
    assert.equal(diagnostic.snapshot()?.stage, 'workspace-check');
    assert.equal(diagnostic.snapshot()?.outcome, 'completed');
    model.selectStore(store);
    const read = diagnostic.begin('invoices');
    await model.read('invoices', { search: 'private-query' });
    diagnostic.finish(read);
    const snapshot = diagnostic.snapshot()!;
    assert.equal(snapshot.stage, 'data-read');
    assert.equal(snapshot.operation, 'invoices');
    assert.equal(snapshot.status, 200);
    assert.equal(calls, 4);
    const text = diagnosticText(snapshot);
    for (const secret of ['private-', user, org, store, '/api/', 'Authorization', 'Bearer'])
        assert.equal(text.includes(secret), false);
    snapshot.code = 'mutated';
    assert.equal(diagnostic.snapshot()?.code, null);
    diagnostic.clear();
    model.clear();
    assert.equal(diagnostic.snapshot(), null);
    assert.equal(calls, 4);
});
test('auth failure is distinguished from successful auth followed by startup failure', async () => {
    const diagnostic = createWorkspaceDiagnostics({ signIn: async () => { throw new AuthCheckError('AUTH_INVALID_CREDENTIALS', 400, 'private-provider-detail'); }, transport: async () => { throw new Error('must not read'); } });
    const attempt = diagnostic.begin('signIn');
    try {
        await diagnostic.ports.signIn('private-email', 'private-password', new AbortController().signal);
    }
    catch (error) {
        diagnostic.finish(attempt, error);
    }
    assert.equal(diagnostic.snapshot()?.stage, 'sign-in');
    assert.equal(diagnostic.snapshot()?.category, 'authentication');
    assert.equal(diagnostic.snapshot()?.code, 'AUTH_INVALID_CREDENTIALS');
    assert.equal(diagnosticText(diagnostic.snapshot()!).includes('private-'), false);
    const startup = createWorkspaceDiagnostics({ now: () => 1000, signIn: async () => session, transport: async () => ({ status: 503, body: JSON.stringify({ code: 'SERVICE_UNAVAILABLE', error: 'private-backend' }) }) });
    const model = createReadOnlyWorkspace(startup.ports), n = startup.begin('signIn');
    try {
        await model.signIn('private-email', 'private-password', true);
    }
    catch (error) {
        startup.finish(n, error);
    }
    assert.equal(startup.snapshot()?.stage, 'workspace-check');
    assert.equal(startup.snapshot()?.status, 503);
    assert.ok(diagnosticRecovery(startup.snapshot()!).includes('startup route'));
    assert.equal(model.summary(), null);
});
test('data decode failure reports HTTP 200 without claiming a successful read', async () => {
    const diagnostic = createWorkspaceDiagnostics({ now: () => 1000, signIn: async () => session, transport: async (req) => body(req.url === '/api/startup-context' ? context : { private: 'invalid-record-payload' }) });
    const model = createReadOnlyWorkspace(diagnostic.ports);
    await model.signIn('private-email', 'private-password', true);
    model.selectStore(store);
    const n = diagnostic.begin('products');
    try {
        await model.read('products');
    }
    catch (error) {
        diagnostic.finish(n, error);
    }
    assert.equal(diagnostic.snapshot()?.stage, 'data-read');
    assert.equal(diagnostic.snapshot()?.status, 200);
    assert.equal(diagnostic.snapshot()?.outcome, 'failed');
    assert.equal(diagnostic.snapshot()?.category, 'invalid-response');
    assert.equal(model.summary(), null);
});
test('late response and completion cannot restore a cleared diagnostic or overwrite a newer attempt', async () => {
    let release!: (v: {
        status: number;
        body: string;
    }) => void;
    const diagnostic = createWorkspaceDiagnostics({ signIn: async () => session, transport: async () => new Promise(resolve => release = resolve) });
    const old = diagnostic.begin('products');
    const pending = diagnostic.ports.transport({ method: 'GET', url: '/api/startup-context', headers: { Authorization: 'private-token' } });
    diagnostic.clear();
    const current = diagnostic.begin('inventory');
    diagnostic.finish(current, new HardwareReadError('forbidden', 'private-message', 403));
    release(body(context));
    await pending;
    diagnostic.finish(old);
    assert.equal(diagnostic.snapshot()?.operation, 'inventory');
    assert.equal(diagnostic.snapshot()?.status, 403);
    assert.equal(diagnostic.snapshot()?.outcome, 'failed');
    diagnostic.finish(current);
    assert.equal(diagnostic.snapshot()?.outcome, 'failed');
    diagnostic.clear();
    diagnostic.finish(old, new Error('private'));
    assert.equal(diagnostic.snapshot(), null);
});
test('arbitrary code/reference/provider text and invalid HTTP metadata cannot enter diagnostic or visible error', () => {
    const diagnostic = createWorkspaceDiagnostics({ signIn: async () => session, transport: async () => body({}) });
    const n = diagnostic.begin('products');
    const error = new HardwareReadError('http', 'private-message', NaN, 'private-token-value', 'private-correlation');
    diagnostic.finish(n, error);
    assert.equal(diagnostic.snapshot()?.code, null);
    assert.equal(diagnostic.snapshot()?.reference, null);
    assert.equal(diagnostic.snapshot()?.status, null);
    assert.equal(diagnosticText(diagnostic.snapshot()!).includes('private'), false);
    assert.equal(connectionError(error).includes('private'), false);
    const auth = new AuthCheckError('private-code' as AuthCheckCode, NaN, 'private-provider');
    assert.equal(connectionError(auth).includes('private'), false);
    assert.ok(connectionError(auth).includes('AUTH_RESPONSE_INVALID'));
    const valid = new HardwareReadError('http', 'private-message', 503, 'AP_SCHEMA_UNAVAILABLE', id);
    assert.ok(connectionError(valid).includes(id));
    const m = diagnostic.begin('supplierInvoices');
    diagnostic.finish(m, valid);
    assert.equal(diagnostic.snapshot()?.reference, id);
    assert.ok(diagnosticRecovery(diagnostic.snapshot()!).includes('backend owner'));
});
test('rendered diagnostics expand failures, stay local, expose no send/export/retry control and clear completely', () => {
    const diagnostic = createWorkspaceDiagnostics({ signIn: async () => session, transport: async () => body({}) });
    assert.equal(workspaceDiagnosticPanel(diagnostic.snapshot()), '');
    const n = diagnostic.begin('rateDifferences');
    diagnostic.finish(n, new HardwareReadError('http', 'private-message', 503, 'AP_FEATURE_DISABLED'));
    const html = workspaceDiagnosticPanel(diagnostic.snapshot());
    assert.ok(html.includes(' open'));
    assert.ok(html.includes('Safe connection diagnostic'));
    assert.ok(html.includes('AP_FEATURE_DISABLED'));
    assert.equal(/<button|<form|href=|<script/.test(html), false);
    assert.equal(html.includes('private-message'), false);
    const success = diagnostic.begin('inventory');
    diagnostic.finish(success);
    assert.equal(workspaceDiagnosticPanel(diagnostic.snapshot()).includes(' open'), false);
    diagnostic.clear();
    assert.equal(workspaceDiagnosticPanel(diagnostic.snapshot()), '');
});
test('recovery advice distinguishes access, throttling and hosting failures without recommending a write', () => {
    const diagnostic = createWorkspaceDiagnostics({ signIn: async () => session, transport: async () => body({}) });
    for (const [error, expected] of [[new HardwareReadError('forbidden', 'raw', 403), 'account administrator'], [new HardwareReadError('network', 'raw'), 'hosting'], [new HardwareReadError('http', 'raw', 429), 'rate limiting']] as const) {
        const n = diagnostic.begin('products');
        diagnostic.finish(n, error);
        assert.ok(diagnosticRecovery(diagnostic.snapshot()!).includes(expected));
    }
});
