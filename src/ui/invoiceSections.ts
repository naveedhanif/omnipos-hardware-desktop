import type { DemoBusinessService } from '../services/demoBusinessService';
import type { InvoiceDraft } from '../services/contracts';
import type { SampleWorkspaceService } from '../services/sampleWorkspaceService';
import { money, totals } from '../money';
import { escapeHtml as esc } from './html';

export const invoiceSections = [
  ['Items', 'F3'], ['Charges & deductions', 'F4'], ['Batch details', 'F5'],
  ['Bills payable', 'F6'], ['Bills receivable', 'F7'], ['Cash', 'F8'],
  ['Cheques', 'F9'], ['Post dated cheques', 'F11'], ['Cheques [PDC]', 'F12'],
  ['Other info', 'Ctrl F3'], ['E-invoice', 'Ctrl F4'], ['Summary', 'Ctrl F5'],
  ['Allocations', 'Ctrl F6'], ['Notes', 'Ctrl F7'],
] as const;

export function sectionForShortcut(event: KeyboardEvent): string | undefined {
  if (event.altKey || event.shiftKey || event.metaKey) return;
  const shortcut = `${event.ctrlKey ? 'Ctrl ' : ''}${event.key}`;
  return invoiceSections.find(([, key]) => key === shortcut)?.[0];
}

export function sectionTabs(selected: string, itemCount: number): string {
  return `<div class="section-navigation"><button class="tab-scroll" data-tab-scroll="-1" aria-label="Scroll invoice sections left">‹</button>
    <div class="section-tabs" role="tablist" aria-label="Invoice sections">${invoiceSections.map(([name, key], i) => `
      <button type="button" id="invoice-tab-${i}" role="tab" aria-selected="${selected === name}" aria-controls="section-panel" tabindex="${selected === name ? 0 : -1}" data-section="${name}">
      ${name}<kbd>${key}</kbd>${name === 'Items' ? `<span>${itemCount}</span>` : ''}</button>`).join('')}
    </div><button class="tab-scroll" data-tab-scroll="1" aria-label="Scroll invoice sections right">›</button></div>`;
}

export function sampleTable(columns: string[], rows: string[][], empty = 'No sample records added.'): string {
  return `<div class="table-scroll"><table class="section-table"><thead><tr>${columns.map(c => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${rows.length ? rows.map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${columns.length}" class="empty-state">${esc(empty)}</td></tr>`}</tbody></table></div>`;
}

function previewField(label: string, value = 'Not configured', wide = false): string {
  return `<div class="preview-field${wide ? ' preview-field-wide' : ''}"><span>${label}</span><div>${esc(value)}</div></div>`;
}

export function supplementaryPanel(
  section: string, draft: InvoiceDraft, workspace: SampleWorkspaceService,
  business: DemoBusinessService, allocationForm: (balances: ReturnType<DemoBusinessService['balances']>) => string,
): string | null {
  let description: string, body: string;
  if (section === 'Batch details') {
    description = 'Assign a batch reference to each tracked invoice line. References are saved with the local draft.';
    const lines = draft.lines.map((line, index) => ({ line, index, info: workspace.getItemPresentation(line.product.id) }))
      .filter(({ info }) => info.hasBatch);
    body = lines.length ? `<form data-invoice-form="batch" class="operation-form"><div class="settlement-inputs">${lines.map(({ line, index, info }) =>
      `<label>${esc(line.product.name)} (${esc(line.product.sku)})<input name="batch-${index}" maxlength="80" value="${esc(line.batch ?? info.batch)}"></label>`).join('')}</div>
      <button class="button">Apply batch references</button></form>`
      : '<p>Add a batch-tracked item to assign a reference.</p><button type="button" class="button" data-action="browse">Find an item</button>';
  } else if (section === 'Other info') {
    description = 'Edit the customer reference and delivery details for this draft.';
    body = `<div class="preview-fields">${previewField('Document reference', draft.document)}${previewField('Branch / location', workspace.storeName)}${previewField('Transaction currency', 'KWD')}</div>
      <form data-invoice-form="info" class="operation-form"><div class="settlement-inputs">
      <label>Customer reference<input name="customerReference" maxlength="100" value="${esc(draft.reference)}"></label>
      <label>Delivery address<input name="deliveryAddress" maxlength="240" value="${esc(draft.deliveryAddress)}"></label></div>
      <button class="button">Apply invoice details</button></form>`;
  } else if (section === 'E-invoice') {
    description = 'Review draft details before printing a sample invoice. Electronic submission requires an approved provider and invoice contract.';
    const issues = [
      !draft.date && 'Enter an invoice date.',
      !draft.customer.trim() && 'Select a customer.',
      !draft.lines.length && 'Add at least one invoice item.',
      totals(draft.lines, draft.charge).net <= 0 && 'Enter a positive invoice total.',
    ].filter(Boolean);
    body = `<div class="integration-state"><strong>${issues.length ? 'Draft details needed' : 'Basic draft details present'}</strong>
      ${issues.length ? `<ul>${issues.map(issue => `<li>${esc(issue)}</li>`).join('')}</ul>` : '<p>Review the printable draft. Provider validation and submission are unavailable.</p>'}</div>
      <button type="button" class="button" data-action="print">Preview sample invoice</button>`;
  } else if (section === 'Summary') {
    description = 'Review the current draft and save it locally or preview the invoice.';
    const t = totals(draft.lines, draft.charge);
    body = `<div class="preview-fields">${previewField('Document', draft.document)}${previewField('Date', draft.date)}${previewField('Customer', draft.customer)}${previewField('Payment mode', draft.payment)}</div>
      ${sampleTable(['Line items', 'Quantity', 'Gross amount', 'Discount', 'Charges', 'Net amount (KWD)'], [[String(draft.lines.length), String(t.qty), money(t.gross), money(t.discount), money(draft.charge), money(t.net)]])}
      <div class="operation-actions"><button type="button" class="button" data-action="save">Save local draft</button><button type="button" class="button" data-action="print">Print preview</button></div>`;
  } else if (section === 'Cash') {
    const open = business.read().till.open;
    description = 'Set Cash on the draft and check the till before using Record demo sale.';
    body = `<div class="preview-fields">${previewField('Payment mode', draft.payment)}${previewField('Invoice total (KWD)', money(totals(draft.lines, draft.charge).net))}${previewField('Demo till', open ? 'Open' : 'Closed')}</div>
      <div class="operation-actions">${draft.payment === 'Cash' ? '' : '<button type="button" class="button" data-action="draft-cash">Use cash on this draft</button>'}
      <button type="button" class="button" data-action="workspace:Demo till">${open ? 'View demo till' : 'Open demo till'}</button>
      ${open && draft.payment === 'Cash' ? '<button type="button" class="button primary" data-business-action="record-sale">Record demo sale</button>' : ''}</div>`;
  } else if (section === 'Bills payable') {
    description = 'Review supplier invoice drafts from received sample orders.';
    if (!business.canPurchase()) {
      body = '<p>Owner or administrator access is required for supplier invoices.</p>';
    } else {
      const orders = business.read().orders.filter(order => order.invoiceReference);
      body = sampleTable(['Supplier invoice', 'Purchase order', 'Supplier', 'Order total (KWD)'], orders.map(order => [
        order.invoiceReference ?? '', order.reference, order.supplier,
        money(order.lines.reduce((total, line) => total + line.qty * line.price, 0)),
      ]), 'No supplier invoice drafts yet.') + '<div class="operation-actions"><button type="button" class="button" data-action="workspace:Supplier invoices">Manage supplier invoices</button></div><p>Live supplier balances and payments require an accounting contract.</p>';
    }
  } else if (section === 'Bills receivable' || section === 'Allocations') {
    const balances = business.balances();
    description = section === 'Bills receivable' ? 'Review open sample customer invoices and record an allocation.' : 'Apply a local sample receipt to an outstanding account invoice.';
    body = sampleTable(['Invoice', 'Customer', 'Outstanding (KWD)'], balances.filter(b => b.outstanding > 0)
      .map(b => [b.reference, b.customer, money(b.outstanding / 1000)]), 'No outstanding sample invoices.')
      + allocationForm(balances) + '<div class="operation-actions"><button type="button" class="button" data-action="workspace:Account balances">View allocation history</button></div>';
  } else if (section === 'Cheques' || section === 'Post dated cheques' || section === 'Cheques [PDC]') {
    const postDated = section !== 'Cheques';
    const register = section === 'Cheques [PDC]';
    description = register ? 'Review and remove post-dated cheque entries on this draft.' : 'Capture a cheque reference on this draft for review. Entries are kept separate from invoice tender and bank posting.';
    body = register ? '<button type="button" class="button" data-section="Post dated cheques">Add a post-dated cheque</button>' : `<form data-invoice-form="cheque" data-post-dated="${postDated}" class="operation-form">
      <div class="settlement-inputs"><label>Cheque number<input name="number" maxlength="40" required></label>
      <label>Bank<input name="bank" maxlength="80" required></label>
      <label>${postDated ? 'Maturity date' : 'Cheque date'}<input name="chequeDate" type="date" ${postDated && draft.date ? `min="${esc(draft.date)}"` : ''} required></label>
      <label>Amount (KWD)<input name="amount" type="number" min="0.001" max="100000" step="0.001" required></label></div>
      <button class="button">Add draft cheque</button></form>`;
    const entries = (draft.cheques ?? []).map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.postDated === postDated);
    body += `<div class="table-scroll"><table class="section-table"><thead><tr><th>Cheque number</th><th>Bank</th><th>${postDated ? 'Maturity date' : 'Cheque date'}</th><th>Amount (KWD)</th><th>Action</th></tr></thead><tbody>${entries.map(({ entry, index }) =>
      `<tr><td>${esc(entry.number)}</td><td>${esc(entry.bank)}</td><td>${esc(entry.date)}</td><td>${money(entry.amount)}</td>
      <td><button type="button" class="button" data-remove-cheque="${index}" aria-label="Remove draft cheque ${esc(entry.number)}">Remove</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">No cheque entries on this draft.</td></tr>'}</tbody></table></div>`;
  } else {
    return null;
  }
  return `<section class="supplementary-panel"><div class="panel-heading"><h2>${esc(section)}</h2><span class="sample-label">Local demo</span></div><p class="panel-description">${esc(description)}</p>${body}</section>`;
}
