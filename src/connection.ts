import './styles.css';
import { inspectConnectionConfig } from './integration/connectionConfig';
import { createConnectionCheck } from './integration/connectionCheck';
import { createBrowserCheckPorts } from './integration/browserCheckPorts';
import { escapeHtml as esc } from './ui/html';
import type { BackendStore, ReadProductPage } from './integration/contracts';
// Only public Vite bindings; no environment-file reader and no automatic network activity.
const env = (import.meta as ImportMeta & {
    env: Record<string, string | undefined>;
}).env;
const inspected = inspectConnectionConfig(env, location.origin);
const check = inspected.config ? createConnectionCheck(createBrowserCheckPorts(inspected.config)) : null;
const root = document.querySelector<HTMLDivElement>('#connection-app')!;
let busy = false, generation = 0, company = '', stores: BackendStore[] = [], selectedStore: BackendStore | null = null, page: ReadProductPage | null = null;
let message = 'No live request has been made. Sign in only when you approve the check below.';
function render() {
    root.innerHTML = `<header class="app-header"><a class="brand" href="/"><strong>omnipos</strong><span class="brand-divider"></span><span class="hardware-label">Hardware</span></a><span class="sample-label">Read-only connection</span></header><main class="connection-workspace"><div class="page-heading"><div><h1>Connect to existing OmniPOS</h1><p>Existing accounts and records. Business writes are unavailable.</p></div><a class="button" href="/?document=Connection%20setup">Back to sample workspace</a></div><p class="panel-description">This isolated check does not import live records into sample invoices, browser storage, exports or snapshots. Sign-in creates an authentication session and may create provider audit activity. No account creation, stock update, database change or transaction posting is included.</p>${inspected.missing.length ? `<section class="access-panel"><h2>Configuration needs attention</h2><ul>${inspected.missing.map(m => `<li>${esc(m)}</li>`).join('')}</ul><p>Vercel variables must be present at build time. Correct them and create a new deployment. Preview/custom domains require review.</p></section>` : `<div class="connection-targets"><p><strong>Backend:</strong> ${esc(inspected.config!.apiOrigin)}</p><p><strong>Auth:</strong> ${esc(inspected.config!.authOrigin)}</p></div>`}<p role="status" class="connection-status">${esc(message)}</p>${!stores.length && !page ? `<form id="connection-sign-in" class="operation-form"><h2>Existing account sign-in</h2><div class="settlement-inputs"><label>Email<input name="email" type="email" autocomplete="username" maxlength="254" required ${busy || !check ? 'disabled' : ''}></label><label>Password<input name="password" type="password" autocomplete="current-password" required maxlength="1024" ${busy || !check ? 'disabled' : ''}></label></div><label class="connection-consent"><input type="checkbox" name="consent" required ${busy || !check ? 'disabled' : ''}><span>I approve sign-in to the auth project above and reading my workspace, followed by one product-page read after I select a store. No business data will be changed.</span></label><button class="button primary" ${busy || !check ? 'disabled' : ''}>${busy ? 'Checking sign-in…' : 'Sign in and read workspace'}</button></form>` : ''}${stores.length ? `<form id="connection-products" class="operation-form"><h2>${esc(company)}</h2><p>Select a Hardware store returned by your existing backend. Only page 1, up to 10 products, will be requested.</p><div class="settlement-inputs"><label>Authorized Hardware store<select name="storeId" required ${busy ? 'disabled' : ''}><option value="">Select a store</option>${stores.map(s => `<option value="${esc(s.id)}">${esc(s.name)} (${esc(s.currency)})</option>`).join('')}</select></label></div><button class="button primary" ${busy ? 'disabled' : ''}>${busy ? 'Reading products…' : 'Read 10 products'}</button></form>` : ''}${page ? `<section><h2>Read-only product results</h2><p>${esc(company)} / ${esc(selectedStore?.name)} / ${esc(selectedStore?.currency)}</p><p>Showing ${page.products.length} of ${page.total} products reported by the backend. Nothing was saved locally. The check session has been discarded; a new check requires sign-in.</p><div class="table-scroll"><table class="section-table"><thead><tr><th>SKU</th><th>Product</th><th>Unit</th><th>Stock</th><th>Cost</th><th>Sell price</th></tr></thead><tbody>${page.products.map(p => `<tr><td>${esc(p.sku ?? 'Not recorded')}</td><td>${esc(p.name)}</td><td>${esc(p.uom ?? 'Not recorded')}</td><td>${p.stock_qty ?? 'Unknown'}</td><td>${p.cost_price ?? 'Unknown'}</td><td>${p.sell_price ?? 'Unknown'}</td></tr>`).join('') || '<tr><td colspan="6">No products returned for this store.</td></tr>'}</tbody></table></div></section>` : ''}<div class="operation-actions"><button type="button" class="button" id="end-check">${page ? 'Clear results / new check' : 'End check / clear session'}</button></div><p class="section-footnote">Server authorization remains authoritative. This check does not prove production tenant isolation or resolve the backend authorization gaps recorded in the audit.</p></main>`;
    document.querySelector<HTMLFormElement>('#connection-sign-in')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (busy || !check)
            return;
        const form = event.currentTarget as HTMLFormElement, input = new FormData(form);
        const email = String(input.get('email') ?? ''), password = String(input.get('password') ?? ''), consent = input.get('consent') === 'on';
        form.reset();
        input.delete('password');
        busy = true;
        message = 'Signing in and reading the authorized workspace…';
        const attempt = ++generation;
        render();
        try {
            const result = await check.signIn(email, password, consent);
            if (attempt !== generation)
                return;
            company = result.organization!.name;
            stores = result.stores;
            message = 'Workspace verified. Select a store for the one product read.';
        }
        catch (error) {
            if (attempt !== generation)
                return;
            message = error instanceof Error ? error.message : 'The check could not be verified.';
        }
        finally {
            if (attempt === generation) {
                busy = false;
                render();
            }
        }
    });
    document.querySelector<HTMLFormElement>('#connection-products')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (busy || !check)
            return;
        const id = String(new FormData(event.currentTarget as HTMLFormElement).get('storeId') ?? '');
        if (!stores.some(s => s.id === id))
            return;
        selectedStore = stores.find(s => s.id === id)!;
        busy = true;
        message = 'Reading one product page…';
        const attempt = ++generation;
        render();
        try {
            const result = await check.products(id);
            if (attempt !== generation)
                return;
            page = result;
            message = 'Read completed. No business data was changed.';
        }
        catch {
            if (attempt !== generation)
                return;
            message = 'Product read could not be verified. The check ended; sign in again to start a new attempt.';
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
function clear() { ++generation; check?.clear(); company = ''; stores = []; selectedStore = null; page = null; busy = false; message = 'Check ended. In-memory credentials and results discarded; other OmniPOS sessions were not revoked.'; render(); }
addEventListener('pagehide', () => { ++generation; check?.clear(); page = null; stores = []; root.replaceChildren(); });
// BFCache restore must not display a previous user's live records.
addEventListener('pageshow', event => { if (event.persisted)
    clear(); });
render();
