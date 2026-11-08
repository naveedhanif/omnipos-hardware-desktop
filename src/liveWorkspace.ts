import { liveCashSaleReview, bindLiveCashSaleReview } from './ui/liveCashSaleReview';
import { createWorkspaceDiagnostics } from './integration/workspaceDiagnostics';
import { workspaceDiagnosticPanel } from './ui/workspaceDiagnostics';
import { liveViewLabels as views, liveViewTabs, bindLiveViewTabs, focusLiveControl, liveSessionNotice } from './ui/liveViewTabs';
import './styles.css';
import { inspectConnectionConfig } from './integration/connectionConfig';
import { createBrowserCheckPorts } from './integration/browserCheckPorts';
import { createReadOnlyWorkspace, type LiveView } from './integration/readOnlyWorkspace';
import { readWindow } from './integration/readWindow';
import { connectionResults, type ConnectionResult } from './ui/connectionResults';
import { connectionError } from './ui/connectionError';
import { escapeHtml as esc } from './ui/html';
const env = (import.meta as ImportMeta & {
    env: Record<string, string | undefined>;
}).env;
const inspected = inspectConnectionConfig(env, location.origin), root = document.querySelector<HTMLDivElement>('#live-workspace')!;
const release = document.createElement('footer');
release.className = 'connection-workspace section-footnote';
release.textContent = env.VITE_PILOT_RELEASE
    ? `Frontend commit: ${env.VITE_PILOT_RELEASE}`
    : 'Frontend commit unavailable for this build.';
root.after(release);
let busy = false, generation = 0, view: LiveView = 'products', search = '', result: ConnectionResult | null = null, timer: ReturnType<typeof setTimeout> | undefined;
let message = 'Sign in to browse existing records. No request is made until you approve and submit.';
const diagnostics = inspected.config ? createWorkspaceDiagnostics({ ...createBrowserCheckPorts(inspected.config), onAuthenticated: () => { message = 'Authentication accepted. Loading your authorized company and stores…'; render('live-status'); } }) : null;
const workspace = diagnostics ? createReadOnlyWorkspace(diagnostics.ports) : null;
function clear(expired = false) { ++generation; workspace?.clear(); diagnostics?.clear(); clearTimeout(timer); result = null; search = ''; view = 'products'; busy = false; message = expired ? 'The read-only session ended. Sign in again.' : 'Signed out of this workspace. In-memory session and records cleared.'; render(expired ? 'live-status' : 'live-email'); }
function render(focus?: string) {
    const state = workspace?.summary() ?? null;
    if (!state && result)
        result = null;
    clearTimeout(timer);
    if (state)
        timer = setTimeout(() => clear(true), Math.max(0, state.expiresAt - Date.now()));
    const store = state?.stores.find(s => s.id === state.storeId) ?? null;
    root.innerHTML = `<header class="app-header"><a class="brand" href="/workspace.html"><strong>omnipos</strong><span class="brand-divider"></span><span class="hardware-label">Hardware</span></a><span class="sample-label">Live · read only</span>${state ? `<span class="live-company">${esc(state.company)}</span><button class="button" data-live-end>Sign out</button>` : ''}</header><main class="connection-workspace" id="live-main"><a class="skip" href="#live-status">Skip to workspace status</a><div class="page-heading"><div><h1>${state ? 'Hardware records' : 'Open your Hardware workspace'}</h1><p>Existing OmniPOS records. Business writes are disabled.</p></div><a class="button" href="/">Open sample invoice workspace</a></div><p role="status" aria-live="polite" aria-atomic="true" tabindex="-1" id="live-status" class="connection-status">${esc(message)}</p>${workspaceDiagnosticPanel(diagnostics?.snapshot() ?? null)}${inspected.missing.length ? `<section class="access-panel"><h2>Configuration needs attention</h2><ul>${inspected.missing.map(m => `<li>${esc(m)}</li>`).join('')}</ul></section>` : ''}${!state ? `<section><p>This workspace reads your existing categories, products, suppliers, purchase orders, stock balances, sales invoices, goods receipts, supplier invoices and supplier returns allowed for your account. Your session stays in memory for up to 15 minutes; reloading signs you out. No account, database or transaction changes are included.</p><form class="operation-form" id="live-sign-in"><div class="settlement-inputs"><label>Account email<input id="live-email" name="email" type="email" required autocomplete="username" maxlength="254" ${busy || !workspace ? 'disabled' : ''}></label><label>Password<input name="password" type="password" required autocomplete="current-password" maxlength="1024" ${busy || !workspace ? 'disabled' : ''}></label></div><label class="connection-consent"><input type="checkbox" name="consent" required ${busy || !workspace ? 'disabled' : ''}><span>I approve sign-in to ${esc(inspected.config?.authOrigin ?? 'the configured auth project')} and manual read-only browsing through ${esc(inspected.config?.apiOrigin ?? 'the configured backend')}. Each read rechecks my company, store and access. No business records will be changed.</span></label><button class="button primary" ${busy || !workspace ? 'disabled' : ''}>${busy ? 'Signing in…' : 'Sign in to read-only workspace'}</button></form><a href="/connection.html">Open the one-read diagnostic check</a></section>` : `<section>${liveSessionNotice(state.expiresAt)}<div class="settlement-inputs"><label>Company<input readonly value="${esc(state.company)}"></label><label>Hardware store<select id="live-store" ${busy ? 'disabled' : ''}><option value="">Select a store</option>${state.stores.map(s => `<option value="${esc(s.id)}" ${s.id === state.storeId ? 'selected' : ''}>${esc(s.name)} (${esc(s.currency)})</option>`).join('')}</select></label></div>${liveViewTabs(view, state, busy)}<section role="tabpanel" id="live-view-panel" aria-labelledby="live-tab-${view}" aria-busy="${busy}" tabindex="0"><form id="live-search" class="report-filters">${view !== 'rateDifferences' ? `<label>Search ${esc(views[view].toLowerCase())}<input name="search" maxlength="120" value="${esc(search)}" placeholder="${view === 'supplierReturns' ? 'Return reference' : view === 'supplierInvoices' ? 'Supplier or internal invoice reference' : view === 'receipts' ? 'GRN or delivery reference' : 'Name, code or reference'}" ${busy ? 'disabled' : ''}></label>` : '<p>This report supports invoice paging only.</p>'}<button id="live-load" class="button primary" ${busy || !store ? 'disabled' : ''}>${busy ? 'Checking access and reading…' : 'Load records'}</button>${view !== 'rateDifferences' ? `<button type="button" class="button" data-live-reset ${busy ? 'disabled' : ''}>Clear search</button>` : ''}</form><p class="section-footnote">${store ? `Selected store: ${esc(store.name)}. ` : 'Select a store first. '}Reads are manual, ${view === 'rateDifferences' ? '10 qualifying invoices per page; each invoice may produce multiple or no variance lines' : '10 records per page'}. Switching stores or views clears the displayed records.</p>${result ? `<div id="live-results" role="region" aria-label="${esc(views[view])} results" tabindex="-1">${connectionResults(result, state.company, store, true)}</div><button type="button" class="button" data-live-clear ${busy ? 'disabled' : ''}>Clear displayed records</button>` : '<div class="empty-state">Choose a store and view, then load records. No sample records are substituted.</div>'}${result && result.data.totalPages !== null ? `<div class="report-pagination"><span>${view === 'rateDifferences' ? 'Invoice page' : `Applied search: ${esc(search || 'All records')} · page`} ${result.data.page}</span><div><button class="button" data-live-page="${result.data.page - 1}" ${busy || result.data.page <= 1 ? 'disabled' : ''}>Previous</button><button class="button" data-live-page="${result.data.page + 1}" ${busy || result.data.page >= result.data.totalPages || result.data.page >= 10000 ? 'disabled' : ''}>Next</button></div></div>` : ''}<p class="section-footnote">No export, editing, stock adjustment, checkout or refund is enabled here. Complete reporting, server tenant isolation and write authority still require separate verification.</p></section></section>`}</main>`;
    if (store && result?.kind === 'products') {
        const results = root.querySelector('#live-results');
        results?.insertAdjacentHTML('beforeend', liveCashSaleReview(store, result.data.products, busy));
        if (results) bindLiveCashSaleReview(results, store, result.data.products);
    }
    root.querySelector('#live-check-till')?.addEventListener('click', async () => {
        if (!workspace || busy) return;
        const selectedProduct = root.querySelector<HTMLSelectElement>('#live-sale-product')?.value;
        const attempt = ++generation;
        busy = true;
        message = 'Checking the selected store’s till…';
        render('live-status');
        try {
            const open = await workspace.checkActiveTill();
            if (attempt === generation)
                message = open ? 'The selected store has an open till.' : 'The selected store has no open till.';
        } catch (error) {
            if (attempt === generation) message = connectionError(error);
        } finally {
            if (attempt === generation) {
                busy = false;
                render('live-status');
                const product = root.querySelector<HTMLSelectElement>('#live-sale-product');
                if (product && selectedProduct) {
                    product.value = selectedProduct;
                    product.dispatchEvent(new Event('change'));
                }
            }
        }
    });
    root.querySelector('[data-live-end]')?.addEventListener('click', () => clear());
    root.querySelector<HTMLFormElement>('#live-sign-in')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!workspace || busy)
            return;
        const form = event.currentTarget as HTMLFormElement, fields = new FormData(form), email = String(fields.get('email') ?? ''), password = String(fields.get('password') ?? ''), consent = fields.get('consent') === 'on';
        form.reset();
        fields.delete('password');
        const diagnosticAttempt = diagnostics!.begin('signIn');
        busy = true;
        message = 'Verifying sign-in and authorized workspace…';
        const attempt = ++generation;
        render('live-status');
        try {
            await workspace.signIn(email, password, consent);
            if (attempt !== generation)
                return;
            diagnostics!.finish(diagnosticAttempt);
            message = 'Signed in. Select your Hardware store, then load a read-only view.';
        }
        catch (error) {
            if (attempt !== generation)
                return;
            diagnostics!.finish(diagnosticAttempt, error);
            message = connectionError(error);
        }
        finally {
            if (attempt === generation) {
                busy = false;
                render(workspace.summary() ? 'live-store' : 'live-status');
            }
        }
    });
    root.querySelector<HTMLSelectElement>('#live-store')?.addEventListener('change', event => {
        if (!workspace)
            return;
        try {
            const id = (event.target as HTMLSelectElement).value;
            workspace.selectStore(id || null);
            ++generation;
            diagnostics?.clear();
            result = null;
            search = '';
            message = id ? 'Store selected. Choose a view and load records.' : 'Select a Hardware store before loading records.';
            render('live-store');
        }
        catch (error) {
            result = null;
            message = connectionError(error);
            render();
        }
    });
    bindLiveViewTabs(root, next => {
        if (busy)
            return;
        if (view !== next) {
            view = next;
            diagnostics?.clear();
            result = null;
            search = '';
            message = 'View selected. Load records to request existing data.';
            render(`live-tab-${view}`);
        }
        else
            focusLiveControl(root, `live-tab-${view}`);
    });
    root.querySelector('[data-live-clear]')?.addEventListener('click', () => {
        if (busy)
            return;
        result = null;
        diagnostics?.clear();
        message = 'Displayed records cleared from this page. Your read-only session is still open. No request was sent.';
        render('live-load');
    });
    root.querySelector<HTMLFormElement>('#live-search')?.addEventListener('submit', event => { event.preventDefault(); const input = String(new FormData(event.currentTarget as HTMLFormElement).get('search') ?? ''); void load(1, input); });
    root.querySelector('[data-live-reset]')?.addEventListener('click', () => { search = ''; result = null; diagnostics?.clear(); message = 'Search cleared. Load records to read the first page.'; render('live-load'); });
    root.querySelectorAll<HTMLButtonElement>('[data-live-page]').forEach(button => button.addEventListener('click', () => void load(Number(button.dataset.livePage), search)));
    if (focus)
        focusLiveControl(root, focus);
}
async function load(page: number, input: string) {
    if (!workspace || busy)
        return;
    let q;
    try {
        q = readWindow({ page, search: input });
    }
    catch (error) {
        diagnostics?.clear();
        message = error instanceof Error ? error.message : 'Invalid search.';
        render('live-status');
        return;
    }
    const diagnosticAttempt = diagnostics!.begin(view);
    search = q.search;
    result = null;
    busy = true;
    message = 'Rechecking workspace access, then reading existing records…';
    const attempt = ++generation;
    render('live-status');
    try {
        const data = await workspace.read(view, q);
        if (attempt !== generation)
            return;
        result = data;
        diagnostics!.finish(diagnosticAttempt);
        message = data.kind === 'receipts' && !data.data.available ? 'Goods receipts are unavailable in the existing backend. No setup or database changes were attempted.' : 'Read complete. No business records were changed.';
    }
    catch (error) {
        if (attempt !== generation)
            return;
        diagnostics!.finish(diagnosticAttempt, error);
        message = connectionError(error);
    }
    finally {
        if (attempt === generation) {
            busy = false;
            render(result ? 'live-results' : 'live-status');
        }
    }
}
addEventListener('pagehide', () => { ++generation; workspace?.clear(); diagnostics?.clear(); clearTimeout(timer); result = null; root.replaceChildren(); });
addEventListener('pageshow', event => {
    if (event.persisted)
        clear();
});
render();
