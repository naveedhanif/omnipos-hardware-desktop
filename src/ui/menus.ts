import { purchaseInvoiceOptions, purchaseVoucherPreview } from './purchaseVouchers';
import { sampleWorkspaceService } from '../services/sampleWorkspaceService';
import { sampleTable } from './invoiceSections';
import { escapeHtml as esc } from './html';

export interface MenuEntry { label: string; action?: string; section?: string; children?: MenuEntry[] }
const pages = (...names: string[]): MenuEntry[] => names.map(label => ({ label, action: `workspace:${label}` }));
const invoiceView = (label: string): MenuEntry => ({ label, action: 'invoice' });
const section = (label: string): MenuEntry => ({ label, section: label });
export const appMenus: Record<string, MenuEntry[]> = {
  File: [{ label: 'New sample invoice', action: 'new' }, { label: 'Save local draft', action: 'save' }, { label: 'Restore local draft', action: 'restore' }, { label: 'Print preview', action: 'print' }],
  Masters: [{ label: 'Items', children: [{ label: 'Item catalogue', action: 'catalogue' }, ...pages('Categories', 'Units of measure')] }, ...pages('Customers', 'Suppliers', 'Accounts', 'Branches & locations')],
  Transactions: [
    { label: 'Purchase', children: [
      { label: 'Enquiries', children: pages('New purchase enquiry', 'Purchase enquiries') },
      { label: 'Quotations', children: pages('New purchase quotation', 'Purchase quotations') },
      { label: 'Orders', children: pages('New purchase order', 'Purchase orders') },
      { label: 'Receipts', children: pages('New goods receipt', 'Goods receipts') },
      { label: 'Invoices', children: pages(...purchaseInvoiceOptions) },
      { label: 'Returns', children: pages('New purchase return', 'Purchase returns') },
      { label: 'Purchase rate differences', children: pages('New purchase rate difference', 'Purchase rate differences') },
    ] },
    { label: 'Sales', children: [...pages('Sales quotations', 'Sales orders'), invoiceView('Sales invoice'), ...pages('Sales returns')] },
    { label: 'Inventory', children: [{ label: 'Item catalogue', action: 'catalogue' }, ...pages('Stock balances', 'Stock movements', 'Stock adjustments', 'Stock transfers')] },
    { label: 'Production', children: pages('Production orders', 'Material consumption') },
    { label: 'Finance', children: [section('Bills payable'), section('Bills receivable'), section('Cash'), section('Cheques'), section('Post dated cheques'), section('Cheques [PDC]')] },
    { label: 'General', children: [section('Other info'), section('Allocations'), section('Notes')] },
    { label: 'Vouchers', children: pages('Purchase vouchers', 'New supplier invoice', 'Supplier invoices', 'Payment vouchers', 'Receipt vouchers', 'Journal vouchers') },
  ],
  Reports: [section('Summary'), ...pages('Sales register', 'Purchase register', 'Inventory valuation', 'Customer statement', 'Supplier statement')],
  Tools: [{ label: 'Keyboard shortcuts', action: 'help' }, { label: 'Restore local draft', action: 'restore' }],
  Settings: [...pages('Store settings', 'Document settings'), { label: 'Prototype information', action: 'about' }],
  Help: [{ label: 'Keyboard shortcuts', action: 'help' }, { label: 'About this prototype', action: 'about' }],
};
export function menuMarkup(entries: MenuEntry[], path = 'menu'): string {
  return entries.map((entry, index) => { const id = `${path}-${index}`; return entry.children ? `<div class="submenu-wrap"><button class="submenu-trigger" aria-expanded="false" aria-controls="${id}">${esc(entry.label)}<span aria-hidden="true">›</span></button><div class="submenu" id="${id}" hidden>${menuMarkup(entry.children, id)}</div></div>` :
    `<button ${entry.section ? `data-section="${esc(entry.section)}"` : `data-action="${esc(entry.action)}"`}>${esc(entry.label)}</button>`; }).join('');
}
function collectWorkspacePages(entries: MenuEntry[]): string[] {
  return entries.flatMap(entry => entry.children ? collectWorkspacePages(entry.children) :
    entry.action?.startsWith('workspace:') ? [entry.action.slice('workspace:'.length)] : []);
}
export const workspacePages = new Set(Object.values(appMenus).flatMap(collectWorkspacePages));

export function workspacePreview(name: string): string {
  const voucher = purchaseVoucherPreview(name);
  if (voucher) return voucher;
  const noun = name.toLowerCase();
  const layouts: Record<string, string[]> = {
    Customers: ['Customer code', 'Customer name', 'Phone', 'Email', 'Account status'],
    Suppliers: ['Supplier code', 'Company name', 'Contact', 'Payment terms', 'Status'],
    Categories: ['Category code', 'Category name', 'Parent category', 'Status'],
    'Units of measure': ['Unit code', 'Unit name', 'Decimal quantity', 'Status'],
    Accounts: ['Account code', 'Account name', 'Account type', 'Currency', 'Status'],
    'Branches & locations': ['Branch code', 'Branch name', 'Stock location', 'Status'],
    'Stock balances': ['Item code', 'Product', 'Location', 'On hand', 'Unit', 'Average cost'],
    'Stock movements': ['Reference', 'Date', 'Product', 'Movement type', 'Quantity', 'Unit'],
    'Inventory valuation': ['Item code', 'Product', 'Quantity', 'Average cost', 'Value'],
  };
  const columns = layouts[name] ?? ['Reference', 'Date', name.includes('Purchase') || name.includes('Supplier') ? 'Supplier' : 'Description', 'Currency', 'Amount', 'Status'];
  const register = sampleWorkspaceService.getRegister(name);
  const rows = register.rows;
  if (name.startsWith('New ')) {
    const party = name.includes('purchase') || name.includes('supplier') || name.includes('receipt') ? 'Supplier' : 'Account';
    return `<div class="page-heading"><div><h1>${esc(name)}</h1><p>Document entry layout for design review.</p></div><span class="sample-label">Design preview</span></div>
      <fieldset class="settlement-fields" disabled><legend>Document details (not connected)</legend><div class="settlement-inputs">${['Document reference', 'Date', party, 'Branch', 'Currency', 'External reference'].map(label => `<label><span>${label}</span><input type="${label === 'Date' ? 'date' : 'text'}" placeholder="${label === 'Currency' ? 'KWD' : 'Not entered'}"></label>`).join('')}</div></fieldset>
      ${sampleTable(['Product code', 'Product', 'Unit', 'Quantity', 'Unit rate', 'Amount'], [], 'No items entered. This document is a frontend layout preview.')}
      <div class="preview-boundary"><p>Document fields and business rules are provisional. Saving, approval, receiving and posting are deferred.</p><button class="button" disabled>Save document (not connected)</button></div>`;
  }
  return `<div class="page-heading"><div><h1>${esc(name)}</h1><p>Review the ${esc(noun)} layout in this frontend prototype.</p></div><span class="sample-label">Design preview</span></div>
    <section class="workspace-preview"><div class="preview-toolbar"><label class="preview-search"><span>Search ${esc(noun)}</span><input type="search" id="preview-search" placeholder="Filter visible sample rows…"></label><button class="button" disabled>New record (not connected)</button></div>
    <div class="preview-filters"><label>Status<select disabled><option>All statuses</option></select></label><label>Branch<select disabled><option>Main store</option></select></label><span>Sample records only</span></div>
    ${sampleTable(columns, rows, `No ${noun} sample records. The register layout is ready for review.`)}
    <div class="preview-boundary"><strong>Frontend layout only</strong><p>Creation, approval, posting and backend contracts for this workspace have not been connected. The menu does not indicate an available backend capability.</p></div></section>`;
}
