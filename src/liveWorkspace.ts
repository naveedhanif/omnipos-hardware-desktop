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
const views: Record<LiveView, string> = { products: 'Products', inventory: 'Stock balances', invoices: 'Invoice register', receipts: 'Goods receipts' };
let busy = false, generation = 0, view: LiveView = 'products', search = '', result: ConnectionResult | null = null, timer: ReturnType<typeof setTimeout> | undefined;
let message = 'Sign in to browse existing records. No request is made until you approve and submit.';
const workspace = inspected.config ? createReadOnlyWorkspace({ ...createBrowserCheckPorts(inspected.config), onAuthenticated: () => { message = 'Authentication accepted. Loading your authorized company and stores…'; render(); } }) : null;
function clear(expired = false) { ++generation; workspace?.clear(); clearTimeout(timer); result = null; search = ''; view = 'products'; busy = false; message = expired ? 'The read-only session ended. Sign in again.' : 'Signed out of this workspace. In-memory session and records cleared.'; render(); }
function render() {
    const state = workspace?.summary() ?? null;
    if (!state && result)
        result = null;
    clearTimeout(timer);
    if (state)
        timer = setTimeout(() => clear(true), Math.max(0, state.expiresAt - Date.now()));
    const store = state?.stores.find(s => s.id === state.storeId) ?? null;
    root.innerHTML = `<header class="app-header"><a class="brand" href="/workspace.html"><strong>omnipos</strong><span class="brand-divider"></span><span class="hardware-label">Hardware</span></a><span class="sample-label">Live · read only</span>${state ? `<span class="live-company">${esc(state.company)}</span><button class="button" data-live-end>Sign out</button>` : ''}</header><main class="connection-workspace"><div class="page-heading"><div><h1>${state ? 'Hardware records' : 'Open your Hardware workspace'}</h1><p>Existing OmniPOS records. Business writes are disabled.</p></div><a class="button" href="/">Open sample invoice workspace</a></div><p role="status" class="connection-status">${esc(message)}</p>${inspected.missing.length ? `<section class="access-panel"><h2>Configuration needs attention</h2><ul>${inspected.missing.map(m => `<li>${esc(m)}</li>`).join('')}</ul></section>` : ''}${!state ? `<section><p>This workspace reads your existing products, stock balances, invoices and goods receipts allowed for your account. Your session stays in memory for up to 15 minutes; reloading signs you out. No account, database or transaction changes are included.</p><form class="operation-form" id="live-sign-in"><div class="settlement-inputs"><label>Account email<input name="email" type="email" required autocomplete="username" maxlength="254" ${busy || !workspace ? 'disabled' : ''}></label><label>Password<input name="password" type="password" required autocomplete="current-password" maxlength="1024" ${busy || !workspace ? 'disabled' : ''}></label></div><label class="connection-consent"><input type="checkbox" name="consent" required ${busy || !workspace ? 'disabled' : ''}><span>I approve sign-in to ${esc(inspected.config?.authOrigin ?? 'the configured auth project')} and manual read-only browsing through ${esc(inspected.config?.apiOrigin ?? 'the configured backend')}. Each read rechecks my company, store and access. No business records will be changed.</span></label><button class="button primary" ${busy || !workspace ? 'disabled' : ''}>${busy ? 'Signing in…' : 'Sign in to read-only workspace'}</button></form><a href="/connection.html">Open the one-read diagnostic check</a></section>` : `<section><div class="settlement-inputs"><label>Company<input readonly value="${esc(state.company)}"></label><label>Hardware store<select id="live-store" ${busy ? 'disabled' : ''}><option value="">Select a store</option>${state.stores.map(s => `<option value="${esc(s.id)}" ${s.id === state.storeId ? 'selected' : ''}>${esc(s.name)} (${esc(s.currency)})</option>`).join('')}</select></label></div><div class="live-read-tabs" role="tablist" aria-label="Read-only views">${Object.entries(views).map(([key, label]) => `<button role="tab" aria-selected="${view === key}" data-live-view="${key}" ${busy || ((key === 'invoices' && !state.canReadInvoices) || (key === 'receipts' && !state.canReadPurchasing)) ? 'disabled' : ''}>${label}${['invoices', 'receipts'].includes(key) ? ' · owner/admin' : ''}</button>`).join('')}</div><form id="live-search" class="report-filters"><label>Search ${esc(views[view].toLowerCase())}<input name="search" maxlength="120" value="${esc(search)}" placeholder="Name, code or reference" ${busy ? 'disabled' : ''}></label><button class="button primary" ${busy || !store ? 'disabled' : ''}>${busy ? 'Checking access and reading…' : 'Load records'}</button><button type="button" class="button" data-live-reset ${busy ? 'disabled' : ''}>Clear search</button></form><p class="section-footnote">${store ? `Selected store: ${esc(store.name)}. ` : 'Select a store first. '}Reads are manual, 10 records per page. Switching stores or views clears the displayed records.</p>${result ? connectionResults(result, state.company, store, true) : '<div class="empty-state">Choose a store and view, then load records. No sample records are substituted.</div>'}${result && result.data.totalPages !== null ? `<div class="report-pagination"><span>Applied search: ${esc(search || 'All records')} · page ${result.data.page}</span><div><button class="button" data-live-page="${result.data.page - 1}" ${busy || result.data.page <= 1 ? 'disabled' : ''}>Previous</button><button class="button" data-live-page="${result.data.page + 1}" ${busy || result.data.page >= result.data.totalPages || result.data.page >= 10000 ? 'disabled' : ''}>Next</button></div></div>` : ''}<p class="section-footnote">No export, editing, stock adjustment, checkout or refund is enabled here. Complete reporting, server tenant isolation and write authority still require separate verification.</p></section>`}</main>`;
    root.querySelector('[data-live-end]')?.addEventListener('click', () => clear());
    root.querySelector<HTMLFormElement>('#live-sign-in')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!workspace || busy)
            return;
        const form = event.currentTarget as HTMLFormElement, fields = new FormData(form), email = String(fields.get('email') ?? ''), password = String(fields.get('password') ?? ''), consent = fields.get('consent') === 'on';
        form.reset();
        fields.delete('password');
        busy = true;
        message = 'Verifying sign-in and authorized workspace…';
        const attempt = ++generation;
        render();
        try {
            await workspace.signIn(email, password, consent);
            if (attempt !== generation)
                return;
            message = 'Signed in. Select your Hardware store, then load a read-only view.';
        }
        catch (error) {
            if (attempt !== generation)
                return;
            message = connectionError(error);
        }
        finally {
            if (attempt === generation) {
                busy = false;
                render();
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
            result = null;
            search = '';
            message = id ? 'Store selected. Choose a view and load records.' : 'Select a Hardware store before loading records.';
            render();
        }
        catch (error) {
            result = null;
            message = connectionError(error);
            render();
        }
    });
    root.querySelectorAll<HTMLButtonElement>('[data-live-view]').forEach(button => button.addEventListener('click', () => { view = button.dataset.liveView as LiveView; result = null; search = ''; message = 'View selected. Load records to request existing data.'; render(); }));
    root.querySelector<HTMLFormElement>('#live-search')?.addEventListener('submit', event => { event.preventDefault(); const input = String(new FormData(event.currentTarget as HTMLFormElement).get('search') ?? ''); void load(1, input); });
    root.querySelector('[data-live-reset]')?.addEventListener('click', () => { search = ''; result = null; message = 'Search cleared. Load records to read the first page.'; render(); });
    root.querySelectorAll<HTMLButtonElement>('[data-live-page]').forEach(button => button.addEventListener('click', () => void load(Number(button.dataset.livePage), search)));
}
async function load(page: number, input: string) {
    if (!workspace || busy)
        return;
    let q;
    try {
        q = readWindow({ page, search: input });
    }
    catch (error) {
        message = error instanceof Error ? error.message : 'Invalid search.';
        render();
        return;
    }
    search = q.search;
    result = null;
    busy = true;
    message = 'Rechecking workspace access, then reading existing records…';
    const attempt = ++generation;
    render();
    try {
        const data = await workspace.read(view, q);
        if (attempt !== generation)
            return;
        result = data;
        message = data.kind === 'receipts' && !data.data.available ? 'Goods receipts are unavailable in the existing backend. No setup or database changes were attempted.' : 'Read complete. No business records were changed.';
    }
    catch (error) {
        if (attempt !== generation)
            return;
        message = connectionError(error);
    }
    finally {
        if (attempt === generation) {
            busy = false;
            render();
        }
    }
}
addEventListener('pagehide', () => { ++generation; workspace?.clear(); clearTimeout(timer); result = null; root.replaceChildren(); });
addEventListener('pageshow', event => {
    if (event.persisted)
        clear();
});
render();
