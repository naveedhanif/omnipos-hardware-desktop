import { escapeHtml as esc } from './html';
import { sampleTable } from './invoiceSections';
import { appMenus } from './menus';

const pages = appMenus.Transactions.flatMap(function page(entry): string[] {
    return entry.children?.flatMap(page) ?? (entry.action?.startsWith('workspace:') ? [entry.label] : []);
});
const registers: Record<string, string> = {
    'New purchase enquiry': 'Purchase enquiries',
    'New purchase quotation': 'Purchase quotations',
    'New purchase return': 'Purchase returns',
    'New purchase rate difference': 'Purchase rate differences',
    'Purchase vouchers': 'Purchase Vouchers',
};
type Draft = { reference: string; date: string; description: string };
const drafts = new Map<string, Draft[]>();

export function transactionDraftView(name: string, scope: string, canPurchase: boolean): string | null {
    if (!pages.includes(name)) return null;
    const register = registers[name] ?? name;
    const heading = `<div class="page-heading"><div><h1>${esc(name)}</h1><p>Prepare and review sample drafts for this store.</p></div><span class="sample-label">Sample drafts</span></div>`;
    if (register.toLowerCase().includes('purchase') && !canPurchase)
        return heading + '<p role="alert">Owner or administrator access is required.</p>';
    const rows = (drafts.get(JSON.stringify([scope, register])) ?? []).map(d => [d.reference, d.date, d.description, 'Draft']);
    return heading + `
      <form id="transaction-draft" class="operation-form">
        <div class="settlement-inputs">
          <label>Reference<input name="reference" required maxlength="80"></label>
          <label>Date<input name="date" type="date" required></label>
          <label>Details<textarea name="description" required maxlength="500"></textarea></label>
        </div>
        <button class="button primary">Save sample draft</button>
      </form>
      <section class="workspace-preview">
        <label class="preview-search">Search drafts<input id="preview-search" type="search"></label>
        ${sampleTable(['Reference', 'Date', 'Details', 'Status'], rows, 'No sample drafts for this store.')}
      </section>
      <p class="section-footnote">Drafts stay in this browser tab until you reload or sign out. They do not post stock, payments or ledger entries.</p>`;
}

export function saveTransactionDraft(name: string, scope: string, fields: FormData): void {
    const reference = String(fields.get('reference') ?? '').trim();
    const date = String(fields.get('date') ?? '');
    const description = String(fields.get('description') ?? '').trim();
    if (!reference || reference.length > 80 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !description || description.length > 500)
        throw new Error('Enter a reference, date and details.');
    const key = JSON.stringify([scope, registers[name] ?? name]);
    const rows = drafts.get(key) ?? [];
    if (rows.some(row => row.reference.toLowerCase() === reference.toLowerCase()))
        throw new Error('A draft with that reference already exists.');
    if (rows.length >= 100) throw new Error('This register has reached its sample draft limit.');
    drafts.set(key, [...rows, { reference, date, description }]);
}

export function clearTransactionDrafts(): void {
    drafts.clear();
}
