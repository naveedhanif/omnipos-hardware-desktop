import type { InvoiceDraft } from '../services/contracts';
import { sampleWorkspaceService } from '../services/sampleWorkspaceService';
import { money, totals } from '../money';
import { escapeHtml as esc } from './html';
import { sampleTable } from './invoiceSections';

export function itemGrid(draft: InvoiceDraft, expandedHistory: string | null): string {
  const headers = ['#', 'Product code', 'Product', 'Cost rate', 'Stock available', 'Is batch', 'History', 'SKU / unit', 'Quantity', 'Landed rate', 'Unit rate', 'Gross amount', 'Disc. %', 'Discount', 'Net amount', ''];
  const widths = [30, 90, 190, 74, 82, 54, 62, 58, 74, 80, 80, 90, 64, 80, 92, 30];
  const t = totals(draft.lines);
  return `<div class="grid-scroll-label">Scroll horizontally to see all item columns <span aria-hidden="true">↔</span></div>
  <div class="table-scroll ledger-scroll" tabindex="0" role="region" aria-label="Editable invoice items; scroll for more columns">
  <table class="item-table"><colgroup>${widths.map(width => `<col style="width:${width}px">`).join('')}</colgroup>
  <thead><tr>${headers.map((header, i) => `<th scope="col"${i === 7 ? ' title="SKU / unit follows the reference image: unit of measure. The product SKU is shown under Product code."' : ''}>${header}</th>`).join('')}</tr></thead>
  <tbody>${draft.lines.map((line, i) => {
    const p = line.product, info = sampleWorkspaceService.getItemPresentation(p.id), lineTotal = totals([line]);
    const expanded = expandedHistory === p.id;
    return `<tr>
      <td class="row-number">${i + 1}</td><td class="sku">${esc(p.sku)}</td>
      <td><strong>${esc(p.name)}</strong><span class="item-category">${esc(p.category?.name)}</span></td>
      <td class="numeric">${money(p.cost_price)}</td><td class="numeric ${p.stock_qty === 0 ? 'stock-warning' : ''}">${p.stock_qty ?? 'Unknown'}</td>
      <td class="batch-cell"><input type="checkbox" aria-label="Sample batch tracking for ${esc(p.name)}" ${info.hasBatch ? 'checked' : ''} disabled title="Illustrative batch metadata; not an API field"></td>
      <td><button class="history-button" data-history="${p.id}" aria-expanded="${expanded}" aria-controls="history-${p.id}" aria-label="History for ${esc(p.name)}">History</button></td>
      <td title="Unit of measure">${esc(p.uom)}</td>
      <td><input aria-label="Quantity for ${esc(p.name)}" type="number" min="${p.allow_decimal_qty ? '0.001' : '1'}" max="100000" step="${p.allow_decimal_qty ? '0.001' : '1'}" data-line="${i}" data-key="qty" value="${line.qty}"></td>
      <td class="numeric unavailable-value" title="Landed rate contract has not been verified">Not mapped</td>
      <td><input aria-label="Unit price for ${esc(p.name)}" type="number" min="0" max="100000" step="0.001" data-line="${i}" data-key="price" value="${line.price.toFixed(3)}"></td>
      <td class="numeric" data-gross="${i}">${money(lineTotal.gross)}</td>
      <td><input aria-label="Discount for ${esc(p.name)}" type="number" min="0" max="100" step="0.01" data-line="${i}" data-key="discount" value="${line.discount}"></td>
      <td class="numeric" data-discount-amount="${i}">${money(lineTotal.discount)}</td><td class="numeric line-amount" data-amount="${i}">${money(lineTotal.net)}</td>
      <td><button class="delete-button" data-remove="${i}" aria-label="Remove ${esc(p.name)}">×</button></td>
    </tr>
    <tr class="history-row" id="history-${p.id}" ${expanded ? '' : 'hidden'}><td colspan="16"><div class="history-content"><div class="panel-heading"><h3>Item history: ${esc(p.sku)}</h3><span class="sample-label">Illustrative activity</span><button class="text-button" data-history="${p.id}">Close history</button></div>
      ${expanded ? sampleTable(['Reference', 'Date', 'Movement', 'Details'], sampleWorkspaceService.getItemHistory(p.id).map(h => [h.reference, h.date, h.type, h.note])) : ''}</div></td></tr>`;
  }).join('')}
  ${draft.lines.length ? '' : '<tr><td colspan="16" class="empty-state">Your invoice is empty. Search for an item above to start.</td></tr>'}
  <tr class="add-line"><td colspan="16"><button data-action="browse"><span aria-hidden="true">＋</span> Add another item <span>Search by name, product code or barcode</span></button></td></tr></tbody>
  <tfoot><tr><td colspan="8">${draft.lines.length} line items</td><td class="numeric" id="grid-qty">${t.qty}</td><td colspan="2"></td><td class="numeric" id="grid-gross">${money(t.gross)}</td><td></td><td class="numeric" id="grid-discount">${money(t.discount)}</td><td class="numeric" id="grid-total">${money(t.net)}</td><td></td></tr></tfoot></table></div>
  <div class="table-help"><span>Click quantity, unit rate or discount % to edit. Batch and history are sample views.</span><span>Amounts in KWD</span></div>`;
}
