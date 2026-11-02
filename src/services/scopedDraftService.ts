import { productsForWorkspace } from './sampleHardwareService.ts';
import type { HardwareProduct, InvoiceDraft } from './contracts';
import { assertDemoContext, workspaceKey, type WorkspaceContext } from '../workspace/context.ts';
type DraftStorage = Pick<Storage, 'getItem' | 'setItem'>;
export function draftStorageKey(context: WorkspaceContext): string {
    return `omnipos-hardware-prototype:draft:v2:${workspaceKey(context)}`;
}
function validateDraft(value: unknown, context: WorkspaceContext, catalogue: HardwareProduct[]): asserts value is InvoiceDraft {
    if (!value || typeof value !== 'object')
        throw new Error('Invalid sample draft.');
    const d = value as InvoiceDraft;
    if (d.version !== 1 || !['document', 'date', 'customer', 'reference', 'payment', 'remarks'].every(key => typeof (d as unknown as Record<string, unknown>)[key] === 'string') ||
        !Array.isArray(d.lines) || !Number.isFinite(d.charge) || d.charge < 0 || d.charge > 100000)
        throw new Error('Invalid sample draft.');
    for (const line of d.lines) {
        if (!line?.product || line.product.store_id !== context.storeId ||
            !Number.isFinite(line.qty) || line.qty <= 0 || line.qty > 100000 ||
            !Number.isFinite(line.price) || line.price < 0 || line.price > 100000 ||
            !Number.isFinite(line.discount) || line.discount < 0 || line.discount > 100 ||
            typeof line.product.id !== 'string' || typeof line.product.name !== 'string' || typeof line.product.sku !== 'string' ||
            typeof line.product.uom !== 'string' || !Number.isFinite(line.product.cost_price) ||
            (line.product.stock_qty !== null && !Number.isFinite(line.product.stock_qty)))
            throw new Error('Draft items do not match this sample workspace.');
        const product = catalogue.find(p => p.id === line.product.id);
        if (!product || (!product.allow_decimal_qty && !Number.isInteger(line.qty)))
            throw new Error('Invalid item for this sample workspace.');
        line.product = structuredClone(product);
    }
}
export function createScopedDraftService(context: WorkspaceContext, storage: DraftStorage, getProducts?: () => HardwareProduct[]) {
    assertDemoContext(context);
    const scope = Object.freeze({ ...context }), key = draftStorageKey(scope);
    return {
        save(draft: InvoiceDraft): void {
            validateDraft(draft, scope, getProducts?.() ?? productsForWorkspace(scope));
            storage.setItem(key, JSON.stringify({ version: 2, scope, draft }));
        },
        load(): InvoiceDraft | null {
            // Unscoped v1 drafts are deliberately not assigned to any tenant.
            const raw = storage.getItem(key);
            if (!raw)
                return null;
            const envelope = JSON.parse(raw);
            if (envelope.version !== 2 || !envelope.scope || workspaceKey(envelope.scope) !== workspaceKey(scope))
                throw new Error('Saved draft scope does not match this workspace.');
            validateDraft(envelope.draft, scope, getProducts?.() ?? productsForWorkspace(scope));
            return envelope.draft;
        },
    };
}
