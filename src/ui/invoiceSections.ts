import type { InvoiceDraft } from '../services/contracts';
import { sampleWorkspaceService } from '../services/sampleWorkspaceService';
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
      <button id="invoice-tab-${i}" role="tab" aria-selected="${selected === name}" aria-controls="section-panel" tabindex="${selected === name ? 0 : -1}" data-section="${name}">
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

export function supplementaryPanel(section: string, draft: InvoiceDraft): string | null {
  if (section === 'Items' || section === 'Charges & deductions' || section === 'Notes') return null;
  const banner = '<span class="sample-label">Sample view</span>';
  let description = '', body = '';
  if (section === 'Batch details') {
    description = 'Sample batch assignments for the current invoice items. Batch tracking is not connected.';
    body = sampleTable(['Item code', 'Product', 'Batch tracked', 'Batch reference', 'Expiry', 'Quantity', 'Unit'], draft.lines.map(line => {
      const info = sampleWorkspaceService.getItemPresentation(line.product.id);
      return [line.product.sku, line.product.name, info.hasBatch ? 'Yes (sample)' : 'No (sample)', info.batch ?? 'Not applicable', 'Not provided', String(line.qty), line.product.uom];
    }), 'Add invoice items to preview their batch details.');
  } else if (section === 'Other info') {
    description = 'Additional document information. These fields are presented for design review.';
    body = `<div class="preview-fields">${previewField('Document reference', draft.document)}${previewField('Sales account', 'Mapping pending')}${previewField('Branch / location', 'Main store / Main stock')}${previewField('Sales executive', 'Sample operator')}${previewField('Customer reference', draft.reference || 'Not entered')}${previewField('Delivery address', 'Not entered')}${previewField('Transaction currency', 'KWD')}${previewField('Exchange rate', 'Not configured')}${previewField('Internal remarks', draft.remarks || 'Not entered', true)}</div>`;
  } else if (section === 'E-invoice') {
    description = 'Electronic invoice layout only. No tax authority or e-invoice provider is connected.';
    body = `<div class="integration-state"><strong>Not submitted</strong><p>The required provider, tax identifiers and submission workflow will be reviewed before integration.</p></div>
      <div class="preview-fields">${previewField('Invoice reference', draft.document)}${previewField('Customer tax ID', 'Not provided')}${previewField('E-invoice identifier', 'Not generated')}${previewField('Submission date', 'Not submitted')}${previewField('Provider', 'Not configured')}${previewField('Validation result', 'Not validated')}</div>
      <button class="button" disabled>Submit e-invoice (not connected)</button>`;
  } else if (section === 'Summary') {
    description = 'Review the current sample document. Totals are calculated locally and do not post a sale.';
    const t = totals(draft.lines, draft.charge);
    body = `<div class="preview-fields">${previewField('Document', draft.document)}${previewField('Date', draft.date)}${previewField('Customer', draft.customer)}${previewField('Payment mode', draft.payment)}</div>
      ${sampleTable(['Line items', 'Quantity', 'Gross amount', 'Discount', 'Charges', 'Net amount (KWD)'], [[String(draft.lines.length), String(t.qty), money(t.gross), money(t.discount), money(draft.charge), money(t.net)]])}
      <p class="section-footnote">Tax and landed rate are not configured. No balance, payment or inventory has changed.</p>`;
  } else {
    const register = sampleWorkspaceService.getRegister(section);
    description = register.description;
    const fields: Record<string, string[]> = {
      'Bills payable': ['Supplier account', 'Bill reference', 'Allocation amount (KWD)'],
      'Bills receivable': ['Customer account', 'Invoice reference', 'Allocation amount (KWD)'],
      'Cash': ['Cash account', 'Cash tendered (KWD)', 'Applied amount (KWD)'],
      'Cheques': ['Cheque number', 'Bank name', 'Cheque date', 'Account name', 'Amount (KWD)', 'Reference'],
      'Post dated cheques': ['Cheque number', 'Bank name', 'Issue date', 'Maturity date', 'Amount (KWD)', 'Direction'],
      'Cheques [PDC]': ['PDC reference', 'Cheque number', 'Maturity date', 'Amount (KWD)', 'Allocation reference', 'Allocated (KWD)'],
      'Allocations': ['Document type', 'Document reference', 'Allocation amount (KWD)'],
    };
    body = `<fieldset class="settlement-fields" disabled><legend>Entry layout (not connected)</legend><div class="settlement-inputs">${(fields[section] ?? []).map(label => `<label><span>${label}</span><input type="${label.toLowerCase().includes('date') ? 'date' : 'text'}" placeholder="${label.includes('KWD') ? '0.000' : 'Not entered'}"></label>`).join('')}</div><button class="button" disabled>Add entry (not connected)</button></fieldset>`;
    body += sampleTable(register.columns, register.rows, `No ${section.toLowerCase()} recorded in this sample view.`);
    body += '<p class="section-footnote">Entry, settlement and posting controls will be added after the frontend and contract review.</p>';
  }
  return `<section class="supplementary-panel"><div class="panel-heading"><h2>${esc(section)}</h2>${banner}</div><p class="panel-description">${esc(description)}</p>${body}</section>`;
}
