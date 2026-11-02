import './styles.css';
import { reportWorkspace } from './ui/reportWorkspace';
import { buildDemoReport, defaultReportQuery, type DemoReportQuery } from './services/demoReports';
import { financeWorkspace } from './ui/financeWorkspace';
import { purchaseWorkspace, purchaseLineRow } from './ui/purchaseWorkspace';
import { createDemoSalesDocuments } from './services/demoSalesDocuments';
import { salesDocumentsView } from './ui/salesDocuments';
import { catalogueAdministration } from './ui/catalogueAdministration';
import { safeCsv } from './services/demoCsv';
import { createDemoBusinessService } from './services/demoBusinessService';
import { businessWorkspace } from './ui/businessWorkspace';
import { createDemoAdministration, type DemoRole } from './services/demoAdministration';
import { administrationView, demoSessionGate } from './ui/administration';
import { openSubmenu, handleMenuKey, handleMenuHover } from './ui/menuNavigation';
import { invoiceSections, sectionTabs, sectionForShortcut, supplementaryPanel } from './ui/invoiceSections';
import { itemGrid } from './ui/itemGrid';
import { appMenus, menuMarkup, workspacePages, workspacePreview } from './ui/menus';
import { createSampleHardwareService } from './services/sampleHardwareService';
import { createScopedDraftService } from './services/scopedDraftService';
import { createSampleWorkspaceService } from './services/sampleWorkspaceService';
import { createSampleDraft } from './workspace/sampleDraft';
import { defaultContext, demoOrganizations, readDemoContext, rememberDemoContext, workspaceKey, workspaceDetails, type WorkspaceContext } from './workspace/context';
import { workspaceSwitcher } from './ui/workspaceSwitcher';
import type { InvoiceDraft, HardwareProduct } from './services/contracts';
import { money, totals } from './money';
const paths: Record<string, string> = { grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z', file: 'M14 2H5v20h14V7z M14 2v6h5 M8 12h8 M8 16h6', box: 'm3 7 9-5 9 5v10l-9 5-9-5z M3 7l9 5 9-5 M12 12v10', search: 'm21 21-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0', plus: 'M12 5v14 M5 12h14', down: 'm6 9 6 6 6-6', save: 'M19 21H5a2 2 0 0 1-2-2V3h14l4 4v12a2 2 0 0 1-2 2Z M7 3v6h10V3 M7 21v-8h10v8', print: 'M6 9V3h12v6 M6 18H3V9h18v9h-3 M6 14h12v8H6z', trash: 'M3 6h18 M8 6V3h8v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7', clock: 'M12 7v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0', arrow: 'M5 12h14 m-5-5 5 5-5 5', check: 'm5 12 4 4L19 6', user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-3a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v3', help: 'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4 M12 17h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0', barcode: 'M3 4v16 M6 4v16 M10 4v16 M12 4v16 M16 4v16 M19 4v16 M21 4v16', close: 'm6 6 12 12 M18 6 6 18' };
const icon = (name: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.file}"/></svg>`;
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
let context: WorkspaceContext;
try {
    context = readDemoContext(sessionStorage);
}
catch {
    context = { ...defaultContext };
}
const browserStorage = { getItem: (key: string) => localStorage.getItem(key), setItem: (key: string, value: string) => localStorage.setItem(key, value) };
const adminStorage = browserStorage;
let businessService = createDemoBusinessService(context, browserStorage);
let salesDocuments = createDemoSalesDocuments(context, browserStorage, businessService);
let hardwareService = createSampleHardwareService(context, businessService.listProducts);
let workspaceService = createSampleWorkspaceService(context, businessService);
let administration = createDemoAdministration(context, adminStorage);
let demoSession = 'active';
try {
    demoSession = sessionStorage.getItem('hardware-demo:paused') || 'active';
}
catch { }
let draftService = createScopedDraftService(context, browserStorage, businessService.listProducts);
let editingProductId: string | null = null;
let statementCustomer = '';
const reportQueries = new Map<string, DemoReportQuery>();
let snapshotSelectionRevision = 0;
let pendingBackup: {
    source: string;
    scope: string;
    revision: number;
} | null = null;
let draft: InvoiceDraft = createSampleDraft(context);
let documentTab = new URLSearchParams(location.search).get('document') || 'Sales invoice';
if (!['Sales invoice', 'Item catalogue'].includes(documentTab) && !workspacePages.has(documentTab))
    documentTab = 'Sales invoice';
let section = 'Items', expandedHistory: string | null = null, dirty = false, products: HardwareProduct[] = [], search = '', catalogSearch = '', savedAt = '', undo: InvoiceDraft['lines'] | null = null;
let openDocuments = ['Sales invoice', 'Item catalogue'];
if (!openDocuments.includes(documentTab))
    openDocuments.push(documentTab);
const app = document.querySelector<HTMLDivElement>('#app')!;
function notify(message: string) { const e = document.querySelector<HTMLElement>('#notice')!; e.textContent = message; e.hidden = false; }
function mark() { dirty = true; document.querySelector('#draft-state')!.textContent = 'Unsaved changes'; document.querySelector('#save-state')!.textContent = 'Changes stay in this browser'; }
function field(label: string, name: string, value: string, type = 'text') { return `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${esc(value)}" ${['document', 'salesperson'].includes(name) ? 'readonly' : ''}></label>`; }
function shell() {
    if (demoSession !== 'active') {
        app.innerHTML = demoSessionGate(demoSession === 'expired');
        return;
    }
    const tabScroll = document.querySelector('.section-tabs')?.scrollLeft ?? 0;
    app.innerHTML = `<a class="skip" href="#workspace">Skip to workspace</a><header class="app-header"><a href="/" class="brand"><span class="brand-mark">${icon('box')}</span><strong>omni<span>pos</span></strong><span class="brand-divider"></span><span class="hardware-label">Hardware</span></a>${workspaceSwitcher(context)}<button class="avatar" data-action="operator" aria-label="Sample operator details">SA</button></header><nav class="menubar" aria-label="Application menu">${Object.keys(appMenus).map(n => `<div class="menu-wrap"><button class="menu-trigger" aria-expanded="false">${n}${['Masters', 'Transactions', 'Reports'].includes(n) ? icon('down') : ''}</button><div class="menu" hidden>${menuMarkup(appMenus[n], n.toLowerCase())}</div></div>`).join('')}<span class="keyboard-hint">A workspace built for your counter.</span></nav><div class="document-bar"><div class="document-tabs" role="tablist" aria-label="Open documents">${openDocuments.map(n => `<button role="tab" aria-selected="${documentTab === n}" data-doc="${esc(n)}">${icon(n === 'Sales invoice' ? 'file' : 'box')}${esc(n)}${n === 'Sales invoice' ? '<span class="tab-count">1</span>' : ''}</button>`).join('')}</div><span class="offline">Sample data only</span></div><div class="workspace-layout"><aside class="rail" aria-label="Quick navigation"><button data-doc="Sales invoice" class="${documentTab === 'Sales invoice' ? 'selected' : ''}" aria-label="Sales invoice">${icon('file')}</button><button data-doc="Item catalogue" class="${documentTab === 'Item catalogue' ? 'selected' : ''}" aria-label="Item catalogue">${icon('box')}</button><div class="rail-spacer"></div><button data-action="help" aria-label="Keyboard shortcuts">${icon('help')}</button></aside><main id="workspace">${documentTab === 'Sales invoice' ? invoice() : documentTab === 'Item catalogue' ? catalogue() : extendedWorkspace(documentTab)}</main></div><footer class="statusbar"><span>${icon('check')} Local prototype</span><span>${esc(workspaceDetails(context).organization.name)} / ${esc(workspaceDetails(context).store.name)}</span><span>No backend connected</span><span class="status-end">KWD <span class="status-separator">|</span> 3 decimal places</span></footer><div id="notice" class="notice" role="status" hidden></div>`;
    bind();
    const tabs = document.querySelector('.section-tabs');
    if (tabs)
        tabs.scrollLeft = tabScroll;
}
function extendedWorkspace(name: string) {
    try {
        return administrationView(name, context, administration) ?? catalogueAdministration(name, businessService) ?? salesDocumentsView(name, salesDocuments) ?? reportWorkspace(name, businessService, reportQueries.get(name) ?? { ...defaultReportQuery }) ?? purchaseWorkspace(name, businessService) ?? financeWorkspace(name, businessService, statementCustomer) ?? businessWorkspace(name, businessService, editingProductId) ?? workspacePreview(name, workspaceService);
    }
    catch {
        return '<div class="page-heading"><h1>Local data unavailable</h1></div><p role="alert">This workspace data could not be read. No changes were made. Keep the local data for support. Snapshot restore is not enabled.</p>';
    }
}
function invoice() { return `<div class="page-heading"><div><div class="heading-line"><h1>Sales invoice</h1><span class="draft-badge">${businessService.read().sales.some(sale => sale.reference === draft.document) ? 'Demo recorded' : 'Draft'}</span></div><p>Create an invoice, add items, and review your totals.</p></div><div class="heading-actions"><button class="button" data-business-action="record-sale">Record demo sale</button><button class="button" data-action="new">${icon('plus')} New invoice</button><button class="button icon-button" data-action="print" aria-label="Print invoice">${icon('print')}</button><button class="button primary" data-action="save">${icon('save')} Save draft <kbd>⌘ S</kbd></button></div></div><section class="document-form" aria-label="Invoice details"><div class="form-title"><h2>Invoice details</h2><span id="draft-state">${dirty ? 'Unsaved changes' : savedAt ? 'Saved locally' : 'Sample draft'}</span></div><div class="form-columns"><div>${field('Invoice no.', 'document', draft.document)}${field('Invoice date', 'date', draft.date, 'date')}<label class="field"><span>Branch</span><select disabled><option>${esc(workspaceDetails(context).store.name)}</option></select></label></div><div><label class="field"><span>Customer <span class="required">*</span></span><select name="customer">${workspaceService.getCustomers().includes(draft.customer) ? '' : `<option selected disabled>${esc(draft.customer)} (unavailable)</option>`}${workspaceService.getCustomers().map(name => `<option ${draft.customer === name ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select></label>${field('LPO / reference', 'reference', draft.reference)}<label class="field"><span>Payment mode</span><select name="payment">${['Account', 'Cash', 'Card'].map(p => `<option ${draft.payment === p ? 'selected' : ''}>${p}</option>`).join('')}</select></label></div><div>${field('Salesperson', 'salesperson', 'Sample operator')}<label class="field"><span>Currency</span><select disabled><option>KWD · Kuwaiti Dinar</option></select></label>${field('Remarks', 'remarks', draft.remarks)}</div></div></section><section class="items-workspace" aria-label="Invoice line items"><div class="item-toolbar"><label class="barcode-label" for="item-search">Barcode</label><div class="search-wrap">${icon('search')}<input id="item-search" autocomplete="off" placeholder="Scan barcode or search items…" aria-label="Scan barcode or search items"><kbd>F2</kbd><div id="search-results" class="search-results" hidden></div></div><button class="button" data-action="browse">${icon('plus')} Add item</button><div class="item-count">${draft.lines.length} items <span class="status-separator">|</span> <span id="units">${totals(draft.lines).qty}</span> units</div><button class="text-button" data-action="shortcuts">${icon('grid')} Shortcuts</button></div>${sectionTabs(section, draft.lines.length)}<div id="section-panel" role="tabpanel" aria-labelledby="invoice-tab-${invoiceSections.findIndex(([name]) => name === section)}">${sectionPanel()}</div></section><section class="invoice-bottom"><div class="invoice-memo"><div>${icon('file')}<strong>Document notes</strong></div><p>${esc(draft.remarks) || 'Add delivery instructions or an internal note above.'}</p><div class="local-note">${icon('help')} This sample draft does not post a sale or change stock.</div></div><div class="totals"><div><span>Subtotal</span><strong id="subtotal">${money(totals(draft.lines).gross)}</strong></div><div><span>Item discounts</span><span id="discount">−${money(totals(draft.lines).discount)}</span></div><div><span>Additional charges</span><span id="charge">${money(draft.charge)}</span></div><div class="grand-total"><span>Total amount <small>KWD</small></span><strong id="net">${money(totals(draft.lines, draft.charge).net)}</strong></div><p>Sample prices. No tax configured.</p></div></section><div class="document-footer"><span id="save-state">${savedAt ? `Saved locally at ${savedAt}` : 'Changes stay in this browser'}</span><div><button class="text-button" data-action="restore">${icon('clock')} Restore saved draft</button><button class="text-button" data-business-action="save-quotation">Save as quotation</button><button class="text-button" data-business-action="save-sales-order">Save as order</button><button class="text-button" data-action="summary">Review summary ${icon('arrow')}</button></div></div>`; }
function sectionPanel() {
    const supplementary = supplementaryPanel(section, draft, workspaceService);
    if (supplementary)
        return supplementary;
    if (section === 'Charges & deductions')
        return `<div class="detail-panel"><div class="panel-heading"><h2>Charges & deductions</h2><span class="sample-label">Sample view</span></div><p>Sample delivery or handling charge, included in the displayed total. Item deductions appear in the grid.</p><label class="field"><span>Charge (KWD)</span><input name="charge" type="number" step="0.001" min="0" max="100000" value="${draft.charge}"></label></div>`;
    if (section === 'Notes')
        return `<div class="detail-panel"><label class="field"><span>Document note</span><textarea name="remarks">${esc(draft.remarks)}</textarea></label><p>Notes are stored only with your local sample draft.</p></div>`;
    return itemGrid(draft, expandedHistory, workspaceService);
}
function catalogue() { return `<div class="page-heading"><div><h1>Item catalogue</h1><p>Browse the sample Hardware inventory. Add items to your invoice.</p></div><button class="button" data-action="workspace:Product management">Manage sample products</button></div><div class="catalog-toolbar search-wrap">${icon('search')}<input id="catalog-search" aria-label="Search catalogue" placeholder="Search by name, SKU or barcode" value="${esc(catalogSearch)}"></div><div class="table-scroll"><table class="catalog-table"><thead><tr><th>Item code</th><th>Description</th><th>Category</th><th>Available</th><th>Unit</th><th>Sell price</th><th></th></tr></thead><tbody id="catalog-rows">${catalogRows()}</tbody></table></div><p class="catalog-foot">Inventory is sample data. Adding an item does not reserve or change stock.</p>`; }
function catalogRows() { const rows = products.filter(p => [p.name, p.sku, p.barcode].some(v => v.toLowerCase().includes(catalogSearch.toLowerCase()))); return rows.map(p => `<tr><td class="sku">${esc(p.sku)}</td><td><strong>${esc(p.name)}</strong><span class="item-category">${p.barcode}</span></td><td>${esc(p.category?.name)}</td><td class="numeric ${p.stock_qty === 0 ? 'stock-warning' : ''}">${p.stock_qty ?? 'Unknown'}</td><td>${esc(p.uom)}</td><td class="numeric">${money(p.sell_price)}</td><td><button class="button" data-add="${p.id}">${icon('plus')} Add to invoice</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty-state">No matching sample items. Try another name or SKU.</td></tr>'; }
function switchDoc(n: string) {
    if (!['Sales invoice', 'Item catalogue'].includes(n) && !workspacePages.has(n))
        return;
    if (!openDocuments.includes(n))
        openDocuments.push(n);
    documentTab = n;
    const url = new URL(location.href);
    url.searchParams.set('document', n);
    history.replaceState(null, '', url);
    shell();
    document.querySelector<HTMLElement>('.document-tabs [aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function add(id: string) {
    const p = products.find(p => p.id === id);
    if (!p)
        return;
    undo = structuredClone(draft.lines);
    const existing = draft.lines.find(l => l.product.id === id);
    if (existing)
        existing.qty++;
    else
        draft.lines.push({ product: structuredClone(p), qty: 1, price: p.sell_price, discount: 0 });
    dirty = true;
    shell();
    notify(`${p.name} added to sample invoice.`);
}
function refreshTotals() {
    const t = totals(draft.lines, draft.charge);
    for (const [id, value] of Object.entries({ subtotal: money(t.gross), discount: `−${money(t.discount)}`, charge: money(draft.charge), net: money(t.net), 'grid-total': money(t.gross - t.discount), 'grid-gross': money(t.gross), 'grid-discount': money(t.discount), 'grid-qty': String(t.qty), units: String(t.qty) })) {
        const e = document.getElementById(id);
        if (e)
            e.textContent = value;
    }
    draft.lines.forEach((l, i) => {
        const e = document.querySelector(`[data-amount="${i}"]`);
        if (e)
            e.textContent = money(totals([l]).net);
        const g = document.querySelector(`[data-gross="${i}"]`);
        if (g)
            g.textContent = money(totals([l]).gross);
        const d = document.querySelector(`[data-discount-amount="${i}"]`);
        if (d)
            d.textContent = money(totals([l]).discount);
    });
}
async function action(a: string) {
    if (a.startsWith('workspace:')) {
        switchDoc(a.slice(10));
        return;
    }
    if (a === 'save') {
        const invalid = document.querySelector<HTMLInputElement>('input:invalid');
        if (invalid) {
            invalid.reportValidity();
            return;
        }
        try {
            draftService.save(draft);
            dirty = false;
            savedAt = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            shell();
            notify('Sample draft saved in this browser. No sale was posted.');
        }
        catch {
            notify('Browser storage is unavailable. Your draft has not been saved.');
        }
    }
    else if (a === 'restore') {
        if (dirty && !confirm('Replace unsaved changes with the saved sample draft?'))
            return;
        try {
            const d = draftService.load();
            if (!d) {
                notify('No saved sample draft in this browser yet.');
                return;
            }
            draft = d;
            dirty = false;
            shell();
            notify('Saved sample draft restored.');
        }
        catch {
            notify('Could not restore this local draft. Current edits are still here.');
        }
    }
    else if (a === 'new') {
        if (dirty && !confirm('Start a new sample invoice and discard unsaved changes?'))
            return;
        draft = { ...draft, document: `SAMPLE-${Date.now().toString().slice(-6)}`, lines: [], reference: '', remarks: '', charge: 0 };
        dirty = true;
        switchDoc('Sales invoice');
    }
    else if (a === 'browse') {
        section = 'Items';
        if (documentTab !== 'Sales invoice')
            switchDoc('Sales invoice');
        else
            shell();
        const input = document.querySelector<HTMLInputElement>('#item-search')!;
        input.focus();
        await showResults('');
    }
    else if (a === 'catalogue')
        switchDoc('Item catalogue');
    else if (a === 'invoice')
        switchDoc('Sales invoice');
    else if (a === 'print')
        window.print();
    else if (a === 'summary') {
        selectSection('Summary');
    }
    else if (a === 'purchase')
        notify('Purchase vouchers are not part of this prototype yet. Their contracts need a separate compatibility review.');
    else if (a === 'customers')
        notify('Sample customers: Al Noor Building Maintenance, Gulf Workshop Supplies, and Walk-in customer.');
    else if (a === 'operator')
        notify('Demo operator SA. The company role shown is a sample membership; real authentication and authorization are not connected.');
    else if (a === 'about')
        notify('Standalone visual prototype with local sample data. Product read contract verified against OmniPOS source. No backend connected.');
    else
        notify('Shortcuts: F2 search; F3–F9, F11–F12 invoice sections; Ctrl F3–F7 more sections; Ctrl/⌘ S local save. Use arrow keys in the invoice tab strip. Browser/OS shortcuts may take priority.');
}
let searchRevision = 0;
async function showResults(q: string) {
    const revision = ++searchRevision;
    const e = document.querySelector<HTMLElement>('#search-results');
    if (!e)
        return;
    e.hidden = false;
    e.innerHTML = '<div class="search-message">Loading sample items…</div>';
    try {
        const result = await hardwareService.getHardwareProducts(context.storeId, { search: q, limit: 8 });
        if (revision !== searchRevision)
            return;
        e.innerHTML = result.products.map(p => `<button data-add="${p.id}"><span><strong>${esc(p.name)}</strong><small>${p.sku} / ${p.uom} / ${p.stock_qty ?? 'Unknown'} available</small></span><strong>${money(p.sell_price)} <small>KWD</small></strong>${icon('plus')}</button>`).join('') || '<div class="search-message">No matching items. Try “drill” or HW-1002.</div>';
    }
    catch {
        e.innerHTML = '<div class="search-message">Unable to load sample items. Clear the search and try again.</div>';
    }
}
function bind() {
    document.querySelector('#preview-search')?.addEventListener('input', e => { const q = (e.target as HTMLInputElement).value.toLowerCase(); document.querySelectorAll<HTMLTableRowElement>('.workspace-preview tbody tr').forEach(row => { row.hidden = !row.textContent?.toLowerCase().includes(q); }); });
    document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('.document-form [name], #section-panel [name]').forEach(e => e.addEventListener('change', () => {
        if (e instanceof HTMLInputElement && !e.checkValidity()) {
            e.reportValidity();
            return;
        }
        const n = e.name;
        if (n === 'salesperson')
            return;
        if (n === 'charge')
            draft.charge = Number(e.value);
        else if (['date', 'customer', 'reference', 'payment', 'remarks'].includes(n))
            (draft as unknown as Record<string, unknown>)[n] = e.value;
        mark();
        refreshTotals();
        if (n === 'remarks') {
            const memo = document.querySelector('.invoice-memo p');
            if (memo)
                memo.textContent = draft.remarks || 'No document notes entered.';
        }
    }));
    document.querySelector('#item-search')?.addEventListener('input', e => { search = (e.target as HTMLInputElement).value; void showResults(search); });
    document.querySelector('#item-search')?.addEventListener('keydown', e => {
        if ((e as KeyboardEvent).key === 'Enter') {
            e.preventDefault();
            const b = document.querySelector<HTMLButtonElement>('#search-results [data-add]');
            b?.click();
        }
    });
    document.querySelector('#catalog-search')?.addEventListener('input', e => { catalogSearch = (e.target as HTMLInputElement).value; document.querySelector('#catalog-rows')!.innerHTML = catalogRows(); });
    document.querySelectorAll<HTMLInputElement>('[data-line]').forEach(e => e.addEventListener('input', () => {
        if (!e.checkValidity())
            return;
        const line = draft.lines[Number(e.dataset.line)], key = e.dataset.key as 'qty' | 'price' | 'discount';
        line[key] = Number(e.value);
        mark();
        refreshTotals();
    }));
}
app.addEventListener('click', e => {
    const target = (e.target as Element).closest<HTMLElement>('button');
    if (!target)
        return;
    if (target.dataset.demoSession) {
        if (target.dataset.demoSession === 'enter') {
            demoSession = 'active';
            documentTab = 'Sales invoice';
            const nextUrl = new URL(location.href);
            nextUrl.searchParams.set('document', documentTab);
            history.replaceState(null, '', nextUrl);
            try {
                sessionStorage.removeItem('hardware-demo:paused');
            }
            catch { }
            void loadWorkspaceCatalog();
        }
        else {
            if (dirty && !confirm('End this demo session and discard unsaved edits?'))
                return;
            demoSession = target.dataset.demoSession === 'expire' ? 'expired' : 'signed-out';
            ++searchRevision;
            ++catalogRevision;
            workspaceDrafts.clear();
            pendingBackup = null;
            reportQueries.clear();
            statementCustomer = '';
            products = [];
            undo = null;
            expandedHistory = null;
            editingProductId = null;
            dirty = false;
            savedAt = '';
            draft = createSampleDraft(context);
            openDocuments = ['Sales invoice', 'Item catalogue'];
            documentTab = 'Sales invoice';
            try {
                sessionStorage.setItem('hardware-demo:paused', demoSession);
            }
            catch { }
            shell();
        }
        return;
    }
    if (demoSession !== 'active')
        return;
    if (target.dataset.reportPage) {
        const query = reportQueries.get(documentTab) ?? { ...defaultReportQuery };
        reportQueries.set(documentTab, { ...query, page: Math.max(1, Number(target.dataset.reportPage)) });
        shell();
        return;
    }
    if (target.hasAttribute('data-report-reset')) {
        reportQueries.delete(documentTab);
        shell();
        return;
    }
    if (target.dataset.purchaseRow) {
        const container = document.querySelector('#purchase-lines');
        if (!container)
            return;
        if (target.dataset.purchaseRow === 'add') {
            if (container.children.length >= 100) {
                notify('Use at most 100 purchase lines.');
                return;
            }
            container.insertAdjacentHTML('beforeend', purchaseLineRow(businessService));
        }
        else {
            if (container.children.length <= 1) {
                notify('Keep at least one purchase line.');
                return;
            }
            target.closest('.purchase-line')?.remove();
        }
        return;
    }
    if (target.dataset.businessAction) {
        void handleBusinessAction(target.dataset.businessAction, target.dataset.id ?? '');
        return;
    }
    if (target.classList.contains('menu-trigger')) {
        const open = target.getAttribute('aria-expanded') === 'true';
        closeMenus();
        target.setAttribute('aria-expanded', String(!open));
        (target.nextElementSibling as HTMLElement).hidden = open;
        return;
    }
    if (target.classList.contains('submenu-trigger')) {
        openSubmenu(target, (e.detail > 0 && matchMedia('(hover: hover) and (min-width: 901px)').matches) || target.getAttribute('aria-expanded') !== 'true');
        return;
    }
    if (target.dataset.tabScroll) {
        document.querySelector('.section-tabs')?.scrollBy({ left: Number(target.dataset.tabScroll) * 400, behavior: 'auto' });
        return;
    }
    if (target.dataset.history) {
        expandedHistory = expandedHistory === target.dataset.history ? null : target.dataset.history;
        const scroll = document.querySelector('.ledger-scroll')?.scrollLeft ?? 0;
        shell();
        document.querySelector('.ledger-scroll')!.scrollLeft = scroll;
        document.querySelector<HTMLButtonElement>(`[data-history="${target.dataset.history}"]`)?.focus({ preventScroll: true });
        return;
    }
    closeMenus();
    if (target.dataset.action)
        void action(target.dataset.action);
    if (target.dataset.doc)
        switchDoc(target.dataset.doc);
    if (target.dataset.section) {
        selectSection(target.dataset.section);
    }
    if (target.dataset.add)
        add(target.dataset.add);
    if (target.dataset.remove !== undefined) {
        undo = structuredClone(draft.lines);
        draft.lines.splice(Number(target.dataset.remove), 1);
        dirty = true;
        shell();
        notify('Item removed. Use Ctrl/⌘ Z to undo.');
    }
});
function selectSection(name: string, focus = false) {
    if (!invoiceSections.some(([n]) => n === name))
        return;
    section = name;
    switchDoc('Sales invoice');
    const tab = document.querySelector<HTMLButtonElement>(`.section-tabs [aria-selected="true"]`);
    tab?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (focus)
        tab?.focus({ preventScroll: true });
}
function closeMenus() { document.querySelectorAll<HTMLElement>('.submenu').forEach(e => e.hidden = true); document.querySelectorAll('.submenu-trigger').forEach(e => e.setAttribute('aria-expanded', 'false')); document.querySelectorAll<HTMLElement>('.menu').forEach(e => e.hidden = true); document.querySelectorAll('.menu-trigger').forEach(e => e.setAttribute('aria-expanded', 'false')); }
document.addEventListener('click', e => {
    if (!(e.target as Element).closest('.menu-wrap'))
        closeMenus();
    if (!(e.target as Element).closest('.search-wrap'))
        document.querySelector<HTMLElement>('#search-results')?.setAttribute('hidden', '');
});
app.addEventListener('pointerover', handleMenuHover);
document.addEventListener('keydown', e => {
    if (demoSession !== 'active')
        return;
    if (handleMenuKey(e))
        return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void action('save');
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && undo && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        draft.lines = undo;
        undo = null;
        dirty = true;
        shell();
    }
    if (e.key === 'F2') {
        e.preventDefault();
        void action('browse');
    }
    const shortcut = sectionForShortcut(e);
    if (shortcut) {
        e.preventDefault();
        selectSection(shortcut, true);
    }
    if ((e.target as Element).closest('.section-tabs') && ['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        const index = invoiceSections.findIndex(([n]) => n === section);
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? invoiceSections.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + invoiceSections.length) % invoiceSections.length;
        selectSection(invoiceSections[next][0], true);
    }
    if (e.key === 'Escape') {
        closeMenus();
        document.querySelector<HTMLElement>('#search-results')?.setAttribute('hidden', '');
        document.querySelector<HTMLElement>('#notice')?.setAttribute('hidden', '');
    }
});
window.addEventListener('beforeunload', e => {
    if (dirty) {
        e.preventDefault();
        e.returnValue = '';
    }
});
interface WorkspaceDraftState {
    draft: InvoiceDraft;
    dirty: boolean;
    savedAt: string;
}
const workspaceDrafts = new Map<string, WorkspaceDraftState>();
let catalogRevision = 0;
async function loadWorkspaceCatalog() {
    if (demoSession !== 'active') {
        shell();
        return;
    }
    const revision = ++catalogRevision, service = hardwareService, storeId = context.storeId;
    app.innerHTML = '<p class="startup" role="status">Loading sample workspace…</p>';
    try {
        const result = await service.getHardwareProducts(storeId);
        if (revision !== catalogRevision)
            return;
        products = result.products;
        syncDraftProducts();
        shell();
    }
    catch {
        if (revision !== catalogRevision)
            return;
        app.innerHTML = '<p class="startup" role="alert">Unable to load this sample workspace. Reload to try again.</p>';
    }
}
async function changeWorkspace(next: WorkspaceContext) {
    // Validate first; unknown company/store/user tuples cannot activate a demo workspace.
    const key = workspaceKey(next);
    if (key === workspaceKey(context))
        return;
    workspaceDrafts.set(workspaceKey(context), { draft: structuredClone(draft), dirty, savedAt });
    ++searchRevision;
    products = [];
    undo = null;
    expandedHistory = null;
    search = '';
    catalogSearch = '';
    section = 'Items';
    context = { ...next };
    statementCustomer = '';
    reportQueries.clear();
    pendingBackup = null;
    editingProductId = null;
    businessService = createDemoBusinessService(context, browserStorage);
    salesDocuments = createDemoSalesDocuments(context, browserStorage, businessService);
    administration = createDemoAdministration(context, adminStorage);
    hardwareService = createSampleHardwareService(context, businessService.listProducts);
    workspaceService = createSampleWorkspaceService(context, businessService);
    draftService = createScopedDraftService(context, browserStorage, businessService.listProducts);
    const previous = workspaceDrafts.get(key);
    draft = previous ? structuredClone(previous.draft) : createSampleDraft(context);
    dirty = previous?.dirty ?? false;
    savedAt = previous?.savedAt ?? '';
    documentTab = 'Sales invoice';
    openDocuments = ['Sales invoice', 'Item catalogue'];
    const url = new URL(location.href);
    url.searchParams.set('document', documentTab);
    history.replaceState(null, '', url);
    let remembered = false;
    try {
        remembered = rememberDemoContext(sessionStorage, context);
    }
    catch { }
    await loadWorkspaceCatalog();
    if (document.querySelector('#notice'))
        notify(remembered ? 'Sample workspace switched. Drafts are kept separately for each company and store.' : 'Workspace switched for this page. Browser tab storage is unavailable; selection will reset on reload.');
}
app.addEventListener('change', e => {
    const input = e.target as HTMLSelectElement;
    if (input.id === 'organization-switch') {
        const organization = demoOrganizations.find(o => o.id === input.value);
        if (organization)
            void changeWorkspace({ ...context, organizationId: organization.id, storeId: organization.stores[0].id });
    }
    else if (input.id === 'store-switch') {
        const organization = workspaceDetails(context).organization;
        if (organization.stores.some(s => s.id === input.value))
            void changeWorkspace({ ...context, storeId: input.value });
    }
});
void loadWorkspaceCatalog();
app.addEventListener('submit', event => {
    const form = event.target as HTMLFormElement;
    if (!form.dataset.adminForm)
        return;
    event.preventDefault();
    if (demoSession !== 'active' || !form.reportValidity())
        return;
    const data = new FormData(form), value = (key: string) => String(data.get(key) ?? '');
    try {
        if (form.dataset.adminForm === 'settings')
            administration.saveSettings({ displayName: value('displayName'), documentPrefix: value('documentPrefix'), country: value('country') });
        else if (form.dataset.adminForm === 'onboarding')
            administration.saveSetupDraft({ companyName: value('companyName'), contactEmail: value('contactEmail'), desiredStores: Number(value('desiredStores')), currency: value('currency'), requirements: value('requirements') });
        else if (form.dataset.adminForm === 'member-add')
            administration.addMember({ name: value('name'), email: value('email'), role: value('role') as DemoRole });
        else
            administration.updateMember(form.dataset.memberId!, { role: value('role') as DemoRole, active: value('active') === 'true' });
        shell();
        notify('Demo company data saved locally. No invitation or backend request was sent.');
    }
    catch (error) {
        notify(error instanceof Error ? error.message : 'Demo update could not be saved.');
    }
});
async function refreshBusiness(message: string) {
    const revision = ++catalogRevision, service = hardwareService, store = context.storeId;
    try {
        const result = await service.getHardwareProducts(store);
        if (revision !== catalogRevision || demoSession !== 'active')
            return;
        products = result.products;
        syncDraftProducts();
        shell();
        notify(message);
    }
    catch {
        shell();
        notify('Local data could not be loaded. No further change was made.');
    }
}
async function handleBusinessAction(action: string, id: string) {
    try {
        if (action === 'save-quotation' || action === 'save-sales-order') {
            const invalid = document.querySelector<HTMLInputElement>('.document-form input:invalid, #section-panel input:invalid');
            if (invalid) {
                invalid.reportValidity();
                return;
            }
            const kind = action === 'save-quotation' ? 'quotation' : 'order', reference = salesDocuments.save(kind, draft);
            switchDoc(kind === 'quotation' ? 'Sales quotations' : 'Sales orders');
            notify(`${reference} saved locally. No stock reserved.`);
            return;
        }
        if (action === 'accept-sales-document')
            salesDocuments.accept(id);
        if (action === 'cancel-sales-document') {
            if (!confirm('Cancel this local demo document?'))
                return;
            salesDocuments.cancel(id);
        }
        if (action === 'convert-quotation') {
            salesDocuments.convertToOrder(id);
            switchDoc('Sales orders');
            notify('Demo order created locally. No backend conversion occurred.');
            return;
        }
        if (action === 'load-order-invoice') {
            if (dirty && !confirm('Replace unsaved invoice edits with this demo order?'))
                return;
            draft = salesDocuments.prepareInvoice(id);
            dirty = true;
            undo = null;
            expandedHistory = null;
            section = 'Items';
            switchDoc('Sales invoice');
            notify('Order loaded into a local invoice draft. Record demo sale separately.');
            return;
        }
        if (action === 'edit-product') {
            editingProductId = id;
            switchDoc('Product management');
            return;
        }
        if (action === 'clear-product') {
            editingProductId = null;
            shell();
            return;
        }
        if (action === 'record-sale') {
            const invalid = document.querySelector<HTMLInputElement>('.document-form input:invalid, #section-panel input:invalid');
            if (invalid) {
                invalid.reportValidity();
                return;
            }
            businessService.recordSale(draft);
            dirty = false;
            savedAt = '';
        }
        if (action === 'close-till') {
            businessService.closeTill();
        }
        if (action === 'reverse-sale') {
            if (!confirm('Simulate a full reversal and restore local sample stock? No real refund will be issued.'))
                return;
            businessService.refundSale(id);
        }
        if (action === 'receive-order') {
            if (!confirm('Simulate receiving this order into local sample stock? No GRN or backend receipt will be posted.'))
                return;
            businessService.receiveOrder(id);
        }
        if (action === 'export-setup-draft') {
            const setup = administration.read().setupDraft;
            if (!setup)
                throw new Error('Save a requirements draft first.');
            downloadLocal('sample-tenant-requirements.json', JSON.stringify(setup, null, 2));
            return;
        }
        if (action === 'export-report') {
            const result = buildDemoReport(documentTab, businessService, reportQueries.get(documentTab) ?? { ...defaultReportQuery });
            downloadLocal('sample-filtered-report.csv', safeCsv([result.columns, ...result.allRows]));
            return;
        }
        if (action === 'restore-snapshot') {
            if (!pendingBackup || pendingBackup.scope !== workspaceKey(context) || pendingBackup.revision !== catalogRevision)
                throw new Error('Choose and preview a snapshot again in this workspace.');
            if (!confirm('Replace this store’s local demo business records? Team data, sales quotations/orders and saved drafts are not included. Unsaved invoice edits in this page will be discarded. This cannot restore OmniPOS or its database.'))
                return;
            businessService.restoreBackup(pendingBackup.source, salesDocuments.read().filter(d => d.invoiceReference && d.status === 'converted').map(d => d.invoiceReference!));
            pendingBackup = null;
            dirty = false;
            undo = null;
            draft = createSampleDraft(context);
            await refreshBusiness('Restored local business snapshot only. No backend was contacted.');
            return;
        }
        if (action === 'print-report') {
            window.print();
            return;
        }
        if (['export-products', 'export-sales', 'export-backup', 'import-template'].includes(action)) {
            const data = businessService.read();
            let content = '', file = '';
            if (action === 'export-backup') {
                content = businessService.exportBackup();
                file = 'hardware-demo-store.json';
            }
            else if (action === 'import-template') {
                content = safeCsv([['sku', 'name', 'cost_price', 'sell_price', 'uom'], ['SAMPLE-NEW', 'Sample paint', 1.125, 2.5, 'tin']]);
                file = 'sample-product-template.csv';
            }
            else if (action === 'export-products') {
                content = safeCsv([['sku', 'name', 'cost_price', 'sell_price', 'uom'], ...data.products.map(p => [p.sku, p.name, p.cost_price, p.sell_price, p.uom])]);
                file = 'sample-products.csv';
            }
            else {
                content = safeCsv([['reference', 'customer', 'payment', 'total_kwd', 'status'], ...data.sales.map(s => [s.reference, s.customer, s.payment, s.total / 1000, s.refunded ? 'Demo reversed' : 'Demo recorded'])]);
                file = 'sample-sales.csv';
            }
            downloadLocal(file, content);
            return;
        }
        if (action === 'reactivate-product')
            businessService.reactivateProduct(id);
        if (action === 'archive-product') {
            if (!confirm('Archive this zero-stock sample product?'))
                return;
            businessService.archiveProduct(id);
        }
        await refreshBusiness('Local sample data updated. No backend operation was performed.');
    }
    catch (error) {
        notify(error instanceof Error ? error.message : 'Local update failed.');
    }
}
app.addEventListener('submit', event => {
    const form = event.target as HTMLFormElement;
    if (!form.dataset.businessForm)
        return;
    event.preventDefault();
    if (demoSession !== 'active' || !form.reportValidity())
        return;
    const data = new FormData(form), value = (key: string) => String(data.get(key) ?? '');
    try {
        if (form.dataset.businessForm === 'product') {
            businessService.saveProduct({ id: value('id') || undefined, name: value('name'), sku: value('sku'), cost: Number(value('cost')), price: Number(value('price')), unit: value('unit'), decimal: value('decimal') === 'true', categoryId: value('categoryId') });
            editingProductId = null;
        }
        else if (['taxonomy-add', 'taxonomy-update'].includes(form.dataset.businessForm))
            businessService.saveTaxonomy(form.dataset.kind as 'categories' | 'units', { id: form.dataset.id, name: value('name'), active: form.dataset.businessForm === 'taxonomy-update' ? value('active') === 'true' : undefined });
        else if (form.dataset.businessForm === 'contact-update')
            businessService.saveParty(form.dataset.kind as 'customers' | 'suppliers', { id: form.dataset.id, name: value('name'), contact: value('contact'), active: value('active') === 'true' });
        else if (form.dataset.businessForm === 'party')
            businessService.saveParty(form.dataset.partyKind as 'customers' | 'suppliers', { name: value('name'), contact: value('contact') });
        else if (form.dataset.businessForm === 'order')
            businessService.createOrder({ reference: value('reference'), supplier: value('supplier'), productId: value('productId'), qty: Number(value('qty')), price: Number(value('price')) });
        else if (form.dataset.businessForm === 'supplier-invoice')
            businessService.createSupplierInvoice(value('orderId'), value('reference'));
        else if (form.dataset.businessForm === 'allocation-reversal')
            businessService.reverseAccountPayment(form.dataset.id!, value('reason'));
        else if (form.dataset.businessForm === 'allocation')
            businessService.recordAccountPayment(value('saleId'), Number(value('amount')), value('reference'));
        else if (form.dataset.businessForm === 'till')
            businessService.openTill(Number(value('opening')));
        else if (form.dataset.businessForm === 'stock')
            businessService.adjustStock(value('productId'), Number(value('delta')), value('reason'));
        else
            throw new Error('Unknown local sample form.');
        void refreshBusiness('Saved local sample data only.');
    }
    catch (error) {
        notify(error instanceof Error ? error.message : 'Local update failed.');
    }
});
function syncDraftProducts() {
    const current = businessService.listProducts();
    draft.lines.forEach(line => {
        const product = current.find(p => p.id === line.product.id);
        if (product)
            line.product = structuredClone(product);
    });
}
function downloadLocal(filename: string, content: string) { const url = URL.createObjectURL(new Blob([content], { type: filename.endsWith('.json') ? 'application/json' : 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); notify('Downloaded selected-store sample data. No network request was sent.'); }
app.addEventListener('change', async (event) => {
    const input = event.target as HTMLInputElement;
    if (input.id !== 'product-import' || !input.files?.[0] || demoSession !== 'active')
        return;
    const file = input.files[0], scope = workspaceKey(context), revision = catalogRevision, service = businessService;
    try {
        if (file.size > 500000)
            throw new Error('Use a CSV smaller than 500 KB.');
        const content = await file.text();
        if (scope !== workspaceKey(context) || revision !== catalogRevision || demoSession !== 'active')
            return;
        const count = service.importProducts(content);
        await refreshBusiness(`Imported ${count} local sample products. No live inventory was changed.`);
    }
    catch (error) {
        if (scope === workspaceKey(context) && demoSession === 'active')
            notify(error instanceof Error ? error.message : 'Local sample import failed.');
    }
});
app.addEventListener('submit', event => {
    const form = event.target as HTMLFormElement;
    if (!form.dataset.purchaseForm)
        return;
    event.preventDefault();
    if (demoSession !== 'active' || !form.reportValidity())
        return;
    const data = new FormData(form);
    try {
        if (form.dataset.purchaseForm === 'order') {
            const lines = Array.from(form.querySelectorAll<HTMLElement>('.purchase-line')).map(row => ({ productId: row.querySelector<HTMLSelectElement>('[name=productId]')!.value, qty: Number(row.querySelector<HTMLInputElement>('[name=qty]')!.value), price: Number(row.querySelector<HTMLInputElement>('[name=price]')!.value) }));
            businessService.createOrder({ reference: String(data.get('reference') ?? ''), supplier: String(data.get('supplier') ?? ''), lines });
        }
        else {
            const lines = Array.from(form.querySelectorAll<HTMLElement>('.receipt-line')).map(row => ({ productId: row.dataset.productId!, delivered: Number(row.querySelector<HTMLInputElement>('[name=delivered]')!.value), damaged: Number(row.querySelector<HTMLInputElement>('[name=damaged]')!.value), rejected: Number(row.querySelector<HTMLInputElement>('[name=rejected]')!.value), quarantined: Number(row.querySelector<HTMLInputElement>('[name=quarantined]')!.value) })).filter(row => row.delivered !== 0 || row.damaged !== 0 || row.rejected !== 0 || row.quarantined !== 0);
            businessService.receivePurchase(form.dataset.orderId!, String(data.get('reference') ?? ''), lines);
        }
        void refreshBusiness('Saved local demo purchasing data. No receiving or invoice was posted to the backend.');
    }
    catch (error) {
        notify(error instanceof Error ? error.message : 'Local purchasing update failed.');
    }
});
app.addEventListener('change', event => { const target = event.target as HTMLSelectElement; if (target.id === 'customer-statement-filter' && demoSession === 'active') {
    if (target.value && !businessService.read().customers.some(c => c.id === target.value))
        return;
    statementCustomer = target.value;
    shell();
} });
app.addEventListener('submit', event => { const form = event.target as HTMLFormElement; if (!form.hasAttribute('data-report-filter'))
    return; event.preventDefault(); if (demoSession !== 'active' || !form.reportValidity())
    return; const data = new FormData(form), query = { search: String(data.get('search') ?? ''), from: String(data.get('from') ?? ''), to: String(data.get('to') ?? ''), page: 1 }; try {
    buildDemoReport(documentTab, businessService, query);
    reportQueries.set(documentTab, query);
    shell();
}
catch (error) {
    notify(error instanceof Error ? error.message : 'Invalid report filters.');
} });
app.addEventListener('change', async (event) => {
    const input = event.target as HTMLInputElement;
    if (input.id !== 'snapshot-import' || !input.files?.[0] || demoSession !== 'active')
        return;
    const file = input.files[0], scope = workspaceKey(context), revision = catalogRevision, selectionRevision = ++snapshotSelectionRevision;
    pendingBackup = null;
    const restoreButton = document.querySelector<HTMLButtonElement>('[data-business-action=restore-snapshot]');
    if (restoreButton)
        restoreButton.disabled = true;
    const previewArea = document.querySelector('#snapshot-preview');
    if (previewArea)
        previewArea.textContent = 'Checking selected snapshot…';
    try {
        if (!file.name.toLowerCase().endsWith('.json') || file.size > 2000000)
            throw new Error('Choose a JSON demo snapshot smaller than 2 MB.');
        const source = await file.text();
        if (selectionRevision !== snapshotSelectionRevision || scope !== workspaceKey(context) || revision !== catalogRevision || demoSession !== 'active')
            return;
        const preview = businessService.previewBackup(source);
        pendingBackup = { source, scope, revision };
        const area = document.querySelector<HTMLElement>('#snapshot-preview');
        if (area) {
            area.textContent = `Valid sample snapshot: ${preview.products} products, ${preview.sales} sales, ${preview.orders} purchase orders and ${preview.allocations} allocations.`;
            const button = document.querySelector<HTMLButtonElement>('[data-business-action=restore-snapshot]');
            if (button)
                button.disabled = false;
        }
    }
    catch (error) {
        notify(error instanceof Error ? error.message : 'Snapshot preview failed.');
    }
});
