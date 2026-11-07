import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSampleHardwareService } from '../src/services/sampleHardwareService.ts';
import { createSampleWorkspaceService } from '../src/services/sampleWorkspaceService.ts';
import { createScopedDraftService, draftStorageKey } from '../src/services/scopedDraftService.ts';
import { createSampleDraft } from '../src/workspace/sampleDraft.ts';
import { defaultContext, readDemoContext, workspaceKey, type WorkspaceContext } from '../src/workspace/context.ts';

const a = { ...defaultContext };
const branch: WorkspaceContext = { ...a, storeId: 'sample-hardware-branch' };
const b: WorkspaceContext = { ...a, organizationId: 'sample-organization-b', storeId: 'sample-builders-store' };
function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}

test('sample membership rejects forged organization/store/user tuples', () => {
  for (const context of [{ ...a, organizationId: b.organizationId }, { ...a, storeId: b.storeId }, { ...a, userId: 'someone-else' }]) {
    assert.throws(() => createSampleHardwareService(context));
    assert.throws(() => createScopedDraftService(context, memoryStorage()));
    assert.throws(() => workspaceKey(context));
  }
});

test('bound catalogue rejects another store and produces scoped product identities', async () => {
  const first = createSampleHardwareService(a), second = createSampleHardwareService(b);
  await assert.rejects(first.getHardwareProducts(b.storeId));
  await assert.rejects(second.getHardwareProducts(a.storeId));
  const ar = await first.getHardwareProducts(a.storeId), br = await second.getHardwareProducts(b.storeId);
  assert.ok(ar.products.every(p => p.store_id === a.storeId));
  assert.ok(br.products.every(p => p.store_id === b.storeId));
  assert.equal(br.products.some(p => ar.products.some(other => other.id === p.id)), false);
  const editable = { ...a }, bound = createSampleHardwareService(editable); editable.storeId = b.storeId;
  assert.equal((await bound.getHardwareProducts(a.storeId)).products[0].store_id, a.storeId);
});

test('draft saves, loads and missing states are separate across tenants and branches', () => {
  const storage = memoryStorage();
  const sa = createScopedDraftService(a, storage), sb = createScopedDraftService(b, storage), sc = createScopedDraftService(branch, storage);
  const da = createSampleDraft(a), db = createSampleDraft(b); da.remarks = 'Tenant A only'; db.remarks = 'Tenant B only';
  sa.save(da); assert.equal(sb.load(), null); assert.equal(sc.load(), null); sb.save(db);
  assert.equal(sa.load()?.remarks, 'Tenant A only'); assert.equal(sb.load()?.remarks, 'Tenant B only');
  sc.save({ ...createSampleDraft(branch), remarks: 'Branch only' });
  assert.equal(sc.load()?.remarks, 'Branch only'); assert.equal(sa.load()?.remarks, 'Tenant A only');
  assert.throws(() => sb.save(da));
});

test('copied or corrupt scoped envelopes fail closed; unscoped legacy draft is ignored', () => {
  const storage = memoryStorage(), sa = createScopedDraftService(a, storage), sb = createScopedDraftService(b, storage);
  storage.setItem('omnipos-hardware-prototype:draft:v1', JSON.stringify(createSampleDraft(a)));
  assert.equal(sa.load(), null);
  sa.save(createSampleDraft(a)); storage.setItem(draftStorageKey(b), storage.getItem(draftStorageKey(a))!);
  assert.throws(() => sb.load());
  storage.setItem(draftStorageKey(a), '{invalid'); assert.throws(() => sa.load());
});

test('invoice tab entries survive scoped draft save and reject duplicate or invalid cheques', () => {
  const storage = memoryStorage(), service = createScopedDraftService(a, storage);
  const draft = createSampleDraft(a);
  draft.deliveryAddress = 'Sample receiving bay';
  draft.lines[2].batch = 'BATCH-014';
  const cheque = { number: 'CH-17', bank: 'Sample Bank', date: '2026-11-30', amount: 21.125, postDated: true };
  draft.cheques = [cheque];
  service.save(draft);
  assert.deepEqual(service.load(), draft);
  assert.equal(createScopedDraftService(branch, storage).load(), null);
  assert.throws(() => service.save({ ...draft, cheques: [cheque, { ...cheque, bank: ' sample bank ' }] }), /already/);
  assert.throws(() => service.save({ ...draft, cheques: [{ ...cheque, amount: 0.0001 }] }), /valid cheque/);
  assert.deepEqual(service.load()?.cheques, [cheque]);
});

test('invalid line values and forged product identifiers are refused', () => {
  const service = createScopedDraftService(a, memoryStorage());
  for (const patch of [{ qty: 0 }, { qty: NaN }, { qty: 1.25 }, { price: -1 }, { discount: 101 }]) {
    const draft = createSampleDraft(a); Object.assign(draft.lines[0], patch); assert.throws(() => service.save(draft));
  }
  const forged = createSampleDraft(a); forged.lines[0].product.id = 'unknown-product'; assert.throws(() => service.save(forged));
});

test('customer/register and item history fixtures are bound to the selected sample context', () => {
  const first = createSampleWorkspaceService(a), second = createSampleWorkspaceService(b);
  assert.equal(second.getRegister('Customers').rows.some(row => row.includes('Al Noor Building Maintenance')), false);
  assert.equal(second.getCustomers().includes('Harbour Site Services'), true);
  assert.throws(() => second.getItemHistory(createSampleDraft(a).lines[0].product.id));
  const register = first.getRegister('Customers'); register.rows[0][1] = 'changed';
  assert.notEqual(first.getRegister('Customers').rows[0][1], 'changed');
});

test('tab selection validates remembered context and falls back without granting membership', () => {
  const storage = memoryStorage(); storage.setItem('hardware-demo:workspace', JSON.stringify(b));
  assert.deepEqual(readDemoContext(storage), b);
  storage.setItem('hardware-demo:workspace', JSON.stringify({ ...b, storeId: a.storeId }));
  assert.deepEqual(readDemoContext(storage), a);
  assert.deepEqual(readDemoContext({ getItem() { throw new Error('Unavailable'); } }), a);
});
