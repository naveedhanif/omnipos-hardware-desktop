import type { InvoiceDraft } from './contracts';
import type { DemoBusinessService } from './demoBusinessService';
import type { LocalStoragePort } from './demoAdministration';
import { assertDemoContext, type WorkspaceContext } from '../workspace/context.ts';
import { validateDraft } from './scopedDraftService.ts';
export interface DemoSalesDocument {
    id: string;
    kind: 'quotation' | 'order';
    reference: string;
    status: 'draft' | 'accepted' | 'cancelled' | 'converted';
    createdAt: string;
    draft: InvoiceDraft;
    sourceId: string | null;
    invoiceReference: string | null;
}
export function createDemoSalesDocuments(context: WorkspaceContext, storage: LocalStoragePort, business: DemoBusinessService) {
    assertDemoContext(context);
    const scope = { ...context }, key = `hardware-demo:sales-documents:v1:${scope.organizationId}:${scope.storeId}`;
    function validate(draft: InvoiceDraft) { validateDraft(structuredClone(draft), scope, business.listProducts().map(p => ({ ...p, allow_decimal_qty: true }))); if (!draft.lines.length)
        throw new Error('Add at least one invoice item first.'); }
    function read(): DemoSalesDocument[] {
        const raw = storage.getItem(key);
        if (!raw)
            return [];
        const data = JSON.parse(raw);
        if (data.version !== 1 || data.organizationId !== scope.organizationId || data.storeId !== scope.storeId || !Array.isArray(data.documents) || data.documents.length > 1000)
            throw new Error('Local sales documents do not match this store.');
        const documents = data.documents as DemoSalesDocument[];
        const refs = new Set<string>(), ids = new Set<string>();
        for (const d of documents) {
            if (!d || typeof d.id !== 'string' || !/^[-\w]{1,120}$/.test(d.id) || typeof d.reference !== 'string' || d.reference.length > 100 || !['quotation', 'order'].includes(d.kind) || !['draft', 'accepted', 'cancelled', 'converted'].includes(d.status) || !Number.isFinite(Date.parse(d.createdAt)) || (d.invoiceReference !== null && (typeof d.invoiceReference !== 'string' || d.invoiceReference.length > 100)) || refs.has(d.reference) || ids.has(d.id))
                throw new Error('Invalid local sales document.');
            validate(d.draft);
            refs.add(d.reference);
            ids.add(d.id);
        }
        const sales = business.read().sales;
        for (const d of documents)
            if (d.kind === 'order' && d.invoiceReference && sales.some(s => s.reference === d.invoiceReference))
                d.status = 'converted';
        return documents;
    }
    function commit(documents: DemoSalesDocument[]) { storage.setItem(key, JSON.stringify({ version: 1, organizationId: scope.organizationId, storeId: scope.storeId, documents })); }
    function checkCurrent(draft: InvoiceDraft) { validate(draft); validateDraft(structuredClone(draft), scope, business.listProducts()); const state = business.read(); if (draft.lines.some(l => !state.products.some(p => p.id === l.product.id && p.is_active)))
        throw new Error('A document item is no longer active.'); if (draft.customer !== 'Walk-in customer' && !state.customers.some(p => p.name === draft.customer && p.active !== false))
        throw new Error('Select an active customer before converting.'); }
    function create(kind: DemoSalesDocument['kind'], draft: InvoiceDraft, sourceId: string | null = null): DemoSalesDocument { checkCurrent(draft); const id = crypto.randomUUID(), reference = `${kind === 'quotation' ? 'SQ' : 'SO'}-DEMO-${id.slice(0, 8)}`; return { id, kind, reference, status: 'draft', createdAt: new Date().toISOString(), draft: structuredClone({ ...draft, document: reference }), sourceId, invoiceReference: null }; }
    return {
        read,
        save(kind: DemoSalesDocument['kind'], draft: InvoiceDraft) { if (!['quotation', 'order'].includes(kind))
            throw new Error('Choose a sales quotation or order.'); const documents = read(); if (documents.length >= 1000)
            throw new Error('Demo sales document limit reached.'); const value = create(kind, draft); documents.unshift(value); commit(documents); return value.reference; },
        accept(id: string) { const documents = read(), d = documents.find(d => d.id === id); if (!d || d.status !== 'draft')
            throw new Error('Only a draft document can be accepted.'); checkCurrent(d.draft); d.status = 'accepted'; commit(documents); },
        cancel(id: string) { const documents = read(), d = documents.find(d => d.id === id); if (!d || !['draft', 'accepted'].includes(d.status) || d.invoiceReference)
            throw new Error('This document cannot be cancelled.'); d.status = 'cancelled'; commit(documents); },
        convertToOrder(id: string) { const documents = read(), d = documents.find(d => d.id === id); if (!d || d.kind !== 'quotation' || d.status !== 'accepted')
            throw new Error('Accept a draft quotation before converting it.'); if (documents.length >= 1000)
            throw new Error('Demo document limit reached.'); const order = create('order', d.draft, d.id); d.status = 'converted'; documents.unshift(order); commit(documents); return order.reference; },
        prepareInvoice(id: string) { const documents = read(), d = documents.find(d => d.id === id); if (!d || d.kind !== 'order' || d.status !== 'accepted')
            throw new Error('Confirm an unconverted order first.'); checkCurrent(d.draft); if (!d.invoiceReference) {
            d.invoiceReference = `SI-DEMO-${crypto.randomUUID().slice(0, 12)}`;
            commit(documents);
        } const draft = structuredClone(d.draft); draft.document = d.invoiceReference; validateDraft(draft, scope, business.listProducts()); return draft; },
    };
}
export type DemoSalesDocuments = ReturnType<typeof createDemoSalesDocuments>;
