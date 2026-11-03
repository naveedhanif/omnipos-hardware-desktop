import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const repo = process.argv[2];
assert.ok(repo, 'Pass the path to the existing OmniPOS checkout');
const revision = 'ba2c9418a834a2cc1d2a8ad6987359f550da7ff6';
const source = execFileSync('git', ['-C', repo, 'show', revision + ':server.ts'], { encoding: 'utf8' });
const patch = fileURLToPath(new URL('../docs/patches/hardware-checkout-operator-guard.patch', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'hardware-checkout-guard-'));

try {
    const file = join(directory, 'server.ts');
    writeFileSync(file, source);
    execFileSync('git', ['apply', patch], { cwd: directory });
    const parsed = ts.createSourceFile('server.ts', readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    let handler;
    function visit(node) {
        if (ts.isCallExpression(node) && node.expression.getText(parsed) === 'app.post' &&
            ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === '/api/hardware/checkout') {
            assert.equal(handler, undefined, 'Expected one checkout handler');
            handler = node.arguments[1];
        }
        ts.forEachChild(node, visit);
    }
    visit(parsed);
    assert.ok(handler, 'Checkout route missing');
    const compiled = ts.transpileModule('(' + handler.getText(parsed) + ')', {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;

    let databaseCalls = 0;
    async function invoke(auth, payloadAllowed) {
        const run = runInNewContext(compiled, {
            verifyCaller: async () => auth,
            supabaseAdmin: new Proxy({}, {
                get() { databaseCalls++; throw new Error('Database access attempted'); },
            }),
            handleHardwareError: (_res, error) => { throw error; },
        });
        const request = { get body() {
            assert.ok(payloadAllowed, 'Denied requests must stop before reading the payload');
            return {};
        } };
        const response = { status: status => ({ json: body => ({ status, body }) }) };
        return run(request, response);
    }

    for (const profile of [undefined, { role: 'cashier', is_active: false }, { role: 'cashier' }, { role: 'viewer', is_active: true }]) {
        const result = await invoke({ profile }, false);
        assert.equal(result.status, 403);
        assert.equal(result.body.code, 'HARDWARE_CHECKOUT_FORBIDDEN');
    }
    assert.equal((await invoke({ error: 'Unauthorized', status: 401 }, false)).status, 401);
    for (const role of ['owner', 'admin', 'manager', 'cashier']) {
        const result = await invoke({ profile: { role, is_active: true } }, true);
        assert.equal(result.status, 400);
        assert.equal(result.body.error, 'Missing storeId');
    }
    assert.equal(databaseCalls, 0);
    console.log('Patched checkout handler passed nine cases with zero database calls.');
} finally {
    rmSync(directory, { recursive: true, force: true });
}
