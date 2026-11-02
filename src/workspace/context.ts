/** Prototype workspace identity. This allow-list is demo data, never production authentication. */
export interface WorkspaceContext {
  organizationId: string;
  storeId: string;
  userId: string;
}
export const demoOrganizations = [
  { id: 'sample-organization-a', name: 'Omni Hardware', role: 'Owner', stores: [
    { id: 'sample-hardware-store', name: 'Main store' },
    { id: 'sample-hardware-branch', name: 'Warehouse branch' },
  ] },
  { id: 'sample-organization-b', name: 'Harbour Builders', role: 'Manager', stores: [
    { id: 'sample-builders-store', name: 'Trade counter' },
  ] },
] as const;
export const DEMO_USER_ID = 'sample-operator';
export const defaultContext: Readonly<WorkspaceContext> = Object.freeze({ organizationId: demoOrganizations[0].id, storeId: demoOrganizations[0].stores[0].id, userId: DEMO_USER_ID });

export function assertDemoContext(context: WorkspaceContext): void {
  const organization = demoOrganizations.find(o => o.id === context.organizationId);
  if (context.userId !== DEMO_USER_ID || !organization?.stores.some(s => s.id === context.storeId)) {
    throw new Error('This sample workspace is unavailable.');
  }
}
export function workspaceKey(context: WorkspaceContext): string {
  assertDemoContext(context);
  return [context.organizationId, context.storeId, context.userId].map(encodeURIComponent).join(':');
}
export function workspaceDetails(context: WorkspaceContext) {
  assertDemoContext(context);
  const organization = demoOrganizations.find(o => o.id === context.organizationId)!;
  return { organization, store: organization.stores.find(s => s.id === context.storeId)! };
}
export function readDemoContext(storage: Pick<Storage, 'getItem'>): WorkspaceContext {
  try {
    const raw = storage.getItem('hardware-demo:workspace');
    if (raw) { const context = JSON.parse(raw); assertDemoContext(context); return { organizationId: context.organizationId, storeId: context.storeId, userId: context.userId }; }
  } catch { /* Invalid or unavailable tab storage falls back to the known demo workspace. */ }
  return { ...defaultContext };
}
export function rememberDemoContext(storage: Pick<Storage, 'setItem'>, context: WorkspaceContext): boolean {
  assertDemoContext(context);
  try { storage.setItem('hardware-demo:workspace', JSON.stringify(context)); return true; } catch { return false; }
}
