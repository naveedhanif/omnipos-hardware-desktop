import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionController } from '../src/session/controller.ts';
import { createDemoAdministration } from '../src/services/demoAdministration.ts';
import { defaultContext } from '../src/workspace/context.ts';
const user = '11111111-1111-4111-8111-111111111111', org = '22222222-2222-4222-8222-222222222222', store = '33333333-3333-4333-8333-333333333333';
const startup = () => ({ user: { id: user }, profile: { id: user, organization_id: org, role: 'OWNER', is_active: true }, organization: { id: org, name: 'Fixture' }, stores: [{ id: store, organization_id: org, name: 'Fixture', business_type: 'hardware', currency: 'KWD' }] });
test('session controller handles onboarding, inactive profiles, selection and sign-out', async () => {
    for (const [body, status] of [[{ user: { id: user }, profile: null, organization: null, stores: [] }, 'profile-missing'], [{ ...startup(), profile: { ...startup().profile, is_active: false } }, 'inactive'], [{ ...startup(), organization: null, stores: [] }, 'organization-missing'], [{ ...startup(), stores: [] }, 'stores-missing']] as const) {
        const c = createSessionController(async () => body);
        await c.reconcile(user);
        assert.equal(c.getState().status, status);
    }
    const c = createSessionController(async () => startup());
    await c.reconcile(user);
    assert.equal(c.getState().status, 'store-required');
    c.selectStore(store);
    assert.equal(c.getState().status, 'ready');
    assert.throws(() => c.selectStore(org));
    c.signOut();
    assert.equal(c.getState().status, 'signed-out');
    assert.throws(() => c.selectStore(store));
});
test('sign-out/expiry wins over late bootstrap replies', async () => {
    let release!: (value: unknown) => void;
    const c = createSessionController(() => new Promise(resolve => release = resolve));
    const work = c.reconcile(user, store);
    c.expire();
    release(startup());
    await work;
    assert.equal(c.getState().status, 'expired');
});
test('local tenant administration isolates companies, checks demo role and protects final owner', () => {
    const values = new Map<string, string>(), storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); } };
    const a = createDemoAdministration(defaultContext, storage), b = createDemoAdministration({ ...defaultContext, organizationId: 'sample-organization-b', storeId: 'sample-builders-store' }, storage);
    a.addMember({ name: 'Sample cashier', email: 'cashier@example.invalid', role: 'CASHIER' });
    assert.equal(a.read().members.length, 2);
    assert.equal(b.read().members.length, 1);
    assert.throws(() => b.addMember({ name: 'Someone', email: 'a@example.invalid', role: 'OWNER' }));
    assert.throws(() => a.updateMember('demo-owner', { role: 'MANAGER', active: false }));
    assert.equal(a.read().members[0].active, true);
});
test('tenant setup draft stays local, company scoped and owner managed', () => {
    const values = new Map<string, string>(), storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); } };
    const a = createDemoAdministration(defaultContext, storage), b = createDemoAdministration({ ...defaultContext, organizationId: 'sample-organization-b', storeId: 'sample-builders-store' }, storage);
    const input = { companyName: 'Fixture company', contactEmail: 'OWNER@example.invalid', desiredStores: 3, currency: 'KWD', requirements: 'Two branches and a warehouse' };
    a.saveSetupDraft(input);
    assert.equal(a.read().setupDraft?.status, 'draft');
    assert.equal(a.read().setupDraft?.contactEmail, 'owner@example.invalid');
    assert.equal(b.read().setupDraft, undefined);
    assert.throws(() => b.saveSetupDraft(input));
    assert.throws(() => a.saveSetupDraft({ ...input, desiredStores: 0 }));
    assert.throws(() => a.saveSetupDraft({ ...input, currency: 'USD$' }));
    assert.equal(a.read().settings.documentPrefix, 'HW');
    assert.equal(a.read().setupDraft?.desiredStores, 3);
});
