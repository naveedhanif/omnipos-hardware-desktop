import './styles.css';
import { inspectConnectionConfig } from './integration/connectionConfig';
import { createConnectionCheck } from './integration/connectionCheck';
import { createBrowserCheckPorts } from './integration/browserCheckPorts';
import { escapeHtml as esc } from './ui/html';
import type { BackendStore } from './integration/contracts';
import { connectionResults, type ConnectionResult } from './ui/connectionResults';
import { connectionError } from './ui/connectionError';
// Only public Vite bindings; no environment-file reader and no automatic network activity.
const env = (import.meta as ImportMeta & {
    env: Record<string, string | undefined>;
}).env;
const inspected = inspectConnectionConfig(env, location.origin);
const check = inspected.config ? createConnectionCheck(createBrowserCheckPorts(inspected.config)) : null;
const root = document.querySelector<HTMLDivElement>('#connection-app')!;
let canReadInvoices = false;
let busy = false, generation = 0, company = '', stores: BackendStore[] = [], selectedStore: BackendStore | null = null, result: ConnectionResult | null = null;
let message = 'No live request has been made. Sign in only when you approve the check below.';
function render() {
    root.innerHTML = `<header class="app-header"><a class="brand" href="/"><strong>omnipos</strong><span class="brand-divider"></span><span class="hardware-label">Hardware</span></a><span class="sample-label">Read-only connection</span></header><main class="connection-workspace"><div class="page-heading"><div><h1>Connect to existing OmniPOS</h1><p>Existing accounts and records. Business writes are unavailable.</p></div><a class="button" href="/?document=Connection%20setup">Back to sample workspace</a></div><p class="panel-description">This isolated check does not import live records into sample invoices, browser storage, exports or snapshots. Sign-in creates an authentication session and may create provider audit activity. No account creation, stock update, database change or transaction posting is included.</p>${inspected.missing.length ? `<section class="access-panel"><h2>Configuration needs attention</h2><ul>${inspected.missing.map(m => `<li>${esc(m)}</li>`).join('')}</ul><p>Vercel variables must be present at build time. Correct them and create a new deployment. Preview/custom domains require review.</p></section>` : `<div class="connection-targets"><p><strong>Backend:</strong> ${esc(inspected.config!.apiOrigin)}</p><p><strong>Auth:</strong> ${esc(inspected.config!.authOrigin)}</p></div>`}<p role="status" class="connection-status">${esc(message)}</p>${!stores.length && !result ? `<form id="connection-sign-in" class="operation-form"><h2>Existing account sign-in</h2><div class="settlement-inputs"><label>Email<input name="email" type="email" autocomplete="username" maxlength="254" required ${busy || !check ? 'disabled' : ''}></label><label>Password<input name="password" type="password" autocomplete="current-password" required maxlength="1024" ${busy || !check ? 'disabled' : ''}></label></div><label class="connection-consent"><input type="checkbox" name="consent" required ${busy || !check ? 'disabled' : ''}><span>I approve sign-in to the auth project above and reading my workspace, followed by one selected products, stock-balances or permitted invoice-register read after I select a store. No business data will be changed.</span></label><button class="button primary" ${busy || !check ? 'disabled' : ''}>${busy ? 'Checking sign-in…' : 'Sign in and read workspace'}</button></form>` : ''}${stores.length ? `<form id="connection-read" class="operation-form"><h2>${esc(company)}</h2><p>Select a Hardware store returned by your existing backend. Choose a view. Only page 1, up to 10 records, will be requested.</p><div class="settlement-inputs"><label>Authorized Hardware store<select name="storeId" required ${busy ? 'disabled' : ''}><option value="">Select a store</option>${stores.map(s => `<option value="${esc(s.id)}">${esc(s.name)} (${esc(s.currency)})</option>`).join('')}</select></label><label>Read-only view<select name="view" ${busy ? 'disabled' : ''}><option value="products">Products</option><option value="inventory">Stock balances</option><option value="invoices" ${canReadInvoices ? '' : 'disabled'}>Invoice register (owner/admin)</option></select></label></div><button class="button primary" ${busy ? 'disabled' : ''}>${busy ? 'Reading selected view…' : 'Read selected view'}</button></form>` : ''}${result ? connectionResults(result, company, selectedStore) : ''}<div class="operation-actions"><button type="button" class="button" id="end-check">${result ? 'Clear results / new check' : 'End check / clear session'}</button></div><p class="section-footnote">Server authorization remains authoritative. This check does not prove production tenant isolation or resolve the backend authorization gaps recorded in the audit.</p></main>`;
    document.querySelector<HTMLFormElement>('#connection-sign-in')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (busy || !check)
            return;
        const form = event.currentTarget as HTMLFormElement, input = new FormData(form);
        const email = String(input.get('email') ?? ''), password = String(input.get('password') ?? ''), consent = input.get('consent') === 'on';
        form.reset();
        input.delete('password');
        busy = true;
        message = 'Verifying sign-in and workspace… The backend can take up to a minute to respond.';
        const attempt = ++generation;
        render();
        try {
            const result = await check.signIn(email, password, consent);
            if (attempt !== generation)
                return;
            company = result.organization!.name;
            stores = result.stores;
            canReadInvoices = result.canReadInvoices;
            message = 'Workspace verified. Select a store and view for one read.';
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
    document.querySelector<HTMLFormElement>('#connection-read')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (busy || !check)
            return;
        const fields = new FormData(event.currentTarget as HTMLFormElement);
        const id = String(fields.get('storeId') ?? ''), view = String(fields.get('view') ?? '');
        if (!['products', 'inventory', 'invoices'].includes(view))
            return;
        if (!stores.some(s => s.id === id))
            return;
        selectedStore = stores.find(s => s.id === id)!;
        busy = true;
        message = 'Reading one selected page…';
        const attempt = ++generation;
        render();
        try {
            const loaded: ConnectionResult = view === 'invoices' ? { kind: 'invoices', data: await check.invoices(id) } : view === 'inventory' ? { kind: 'inventory', data: await check.inventory(id) } : { kind: 'products', data: await check.products(id) };
            if (attempt !== generation)
                return;
            result = loaded;
            message = 'Read completed. No business data was changed.';
        }
        catch (error) {
            if (attempt !== generation)
                return;
            message = connectionError(error) + ' The check ended.';
        }
        finally {
            if (attempt === generation) {
                stores = [];
                busy = false;
                render();
            }
        }
    });
    document.querySelector('#end-check')?.addEventListener('click', clear);
}
function clear() { ++generation; check?.clear(); company = ''; canReadInvoices = false; stores = []; selectedStore = null; result = null; busy = false; message = 'Check ended. In-memory credentials and results discarded; other OmniPOS sessions were not revoked.'; render(); }
addEventListener('pagehide', () => { ++generation; check?.clear(); result = null; stores = []; root.replaceChildren(); });
// BFCache restore must not display a previous user's live records.
addEventListener('pageshow', event => {
    if (event.persisted)
        clear();
});
render();
