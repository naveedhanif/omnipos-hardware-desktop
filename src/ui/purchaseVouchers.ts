import { sampleTable } from './invoiceSections';
import { escapeHtml as esc } from './html';

// Screenshot-derived navigation and presentation only; not Hardware API contracts.
export const purchaseInvoiceOptions = [
  'Purchase Vouchers',
  'Purchase Vouchers [Import]',
  'Purchase Vouchers [Excise]',
  'Cash Purchase Vouchers',
  'Purchase Vouchers against Orders',
  'Purchase Vouchers against Orders [Import]',
  'Purchase Vouchers against Orders [Excise]',
  'Purchase Vouchers against Receipts',
  'Purchase Vouchers against Receipts [Import]',
  'Purchase Vouchers against Receipts [Excise]',
  'Proforma Purchase Vouchers',
] as const;

function field(label: string, placeholder = 'Not entered'): string {
  return `<label><span>${esc(label)}</span><input type="${label === 'Voucher date' ? 'date' : 'text'}" placeholder="${esc(placeholder)}"></label>`;
}

export function purchaseVoucherPreview(name: string, storeName: string): string | null {
  if (!(purchaseInvoiceOptions as readonly string[]).includes(name)) return null;
  const source = name.includes('against Orders') ? 'Purchase order' : name.includes('against Receipts') ? 'Goods receipt' : null;
  const variant = name.includes('[Import]') ? 'Import' : name.includes('[Excise]') ? 'Excise' : name.startsWith('Cash') ? 'Cash' : name.startsWith('Proforma') ? 'Proforma' : 'Standard';
  const fields = [field('Voucher number', 'Not assigned'), field('Voucher date'), field('Supplier'), field('Branch', storeName), field('Currency', 'KWD'), field('Supplier invoice number'), field('Payment mode', variant === 'Cash' ? 'Cash' : 'Not selected'), field('LPO / reference'), field('Remarks')];
  if (source) fields.push(field(`${source} reference`, 'Not linked'));
  const extras = variant === 'Import' ? ['Import reference', 'Country of origin', 'Freight / duty reference'] : variant === 'Excise' ? ['Excise reference', 'Registration reference', 'Duty treatment'] : [];
  return `<div class="page-heading"><div><h1>${esc(name)}</h1><p>Purchase voucher layout for frontend review.</p></div><span class="sample-label">Design preview</span></div>
    <div class="voucher-context"><span>Purchase / Invoices</span><span>${variant} voucher</span>${source ? `<span>Source: ${source}</span>` : ''}</div>
    <fieldset class="settlement-fields" disabled><legend>Voucher details (not connected)</legend><div class="settlement-inputs">${fields.join('')}</div></fieldset>
    ${source ? `<section class="voucher-source"><div class="panel-heading"><h2>${source} selection</h2><button class="button" disabled>Select ${source.toLowerCase()} (not connected)</button></div>${sampleTable([`${source} reference`, 'Date', 'Supplier', 'Status', 'Available amount'], [], `No ${source.toLowerCase()} linked. Source selection and matching are deferred.`)}</section>` : ''}
    ${extras.length ? `<fieldset class="settlement-fields" disabled><legend>${variant} information (provisional)</legend><div class="settlement-inputs">${extras.map(label => field(label, 'Not configured')).join('')}</div></fieldset>` : ''}
    <section class="voucher-lines"><div class="panel-heading"><h2>Voucher items</h2><button class="button" disabled>Add item (not connected)</button></div>
      ${sampleTable(['Product code', 'Product', 'Unit', 'Quantity', 'Unit rate', 'Discount', 'Net amount'], [], 'No voucher items entered. This is a design preview.')}</section>
    <div class="voucher-review"><div><strong>Frontend layout only</strong><p>Saving, stock receiving, payment, tax and posting are deferred. Import, excise, proforma and source-matching rules require a separate compatibility review.</p></div><div class="voucher-total"><span>Total (KWD)</span><strong>Not calculated</strong></div></div>
    <div class="voucher-actions"><button class="button" disabled>Save voucher (not connected)</button><button class="button" disabled>Post voucher (not connected)</button></div>`;
}
