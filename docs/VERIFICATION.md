# Prototype verification

2 November 2026, local prototype only.

- TypeScript check and Vite production build passed.
- Two Node tests passed: product search/barcode/pagination/cancellation/store guard/
  fixture isolation; KWD sample rounding, discounts, charges and empty totals.
- Headless Chrome exercised quantity recalculation, search/add, local draft save,
  reload/restore, catalogue search, charges and mobile page overflow at 390px.
  No page errors or non-local requests were observed.
- Desktop (1440px) and mobile (390px) full-page screenshots inspected in-thread.
  The wide editable ledger deliberately scrolls horizontally on small screens.
  Screenshots are generated in ignored `artifacts/`.
- Hallmark static app sweep: 0 FAIL, 0 REFLEX, 0 WARN. Its own render tier could
  not run because puppeteer-core is absent; Chrome checks above used bundled
  Playwright instead. No independent agent review was performed.

Not verified: live API, auth/tenant/store/staff authorization, payments, stock,
accounting, tax, database compatibility or a packaged desktop runtime. None are
connected in this prototype. No OmniPOS source modifications or Supabase operations.


## Screenshot completion pass

The local build and existing tests passed again. Headless Chrome verified all
14 invoice sections, the expanded grid header, F5 and Ctrl F5 routing, arrow-key
tab navigation, inline sample history, gross/net recalculation, local draft
save/reload/restore, nested Purchase navigation, customer filtering, Finance links,
and mobile menu navigation/overflow at 390px. No page errors or external requests
were observed. Desktop, settlement and mobile screenshots were visually inspected.
New sample panels and menus are design previews; no live contract was added.


## Purchase cascade pass

Verified seven screenshot categories and three-level menu nesting in headless Chrome:
hovering each branch preserves its Purchase ancestor; registers open and survive reload;
keyboard arrows reach the third level; Escape returns one level; new-document previews
keep saving disabled; mobile tap navigation reaches Supplier invoices at 390px without
page overflow. Zero browser errors and external requests observed. The cascade screenshot
was inspected visually. New document layouts are provisional frontend previews only.


## Purchase invoice voucher menu

Headless Chrome opened all 11 screenshot destinations and verified their page titles,
disabled posting, desktop submenu fit, direct-URL restoration, receipt-source/import
layouts and mobile navigation to Proforma at 390px. Zero page errors or external
requests observed. Menu and receipt/import screenshots inspected visually. Build,
existing tests and static styling checks pass. No backend integration was performed.


## Phase 1: tenant-aware sample foundation

Status: sample frontend foundation complete; production multi-tenant security is NOT
implemented or verified. No authentication/backend/database connection exists.

- TypeScript/Vite build passed; nine Node tests passed, including seven new tenant
  tests for membership tuples, bound catalog scope, tenant/branch draft separation,
  corrupt/copied envelopes, legacy draft non-adoption, invalid lines/products,
  scoped customer/history fixtures and invalid remembered context.
- Headless Chrome exercised two companies and three stores: company/store-bound
  catalogue/customer/register views; cleared search and undo on switching; preserved
  unsaved drafts per workspace in page memory; distinct local save/reload/restore;
  validated tab selection restore; mobile nested menus and voucher branch context.
- Zero browser errors and non-local requests observed. Desktop and 390px mobile
  screenshots inspected. Static app styling sweep clean. Existing invoice/purchase
  previews remain functional; posting remains disabled.
- Old unscoped v1 browser drafts are not migrated or assigned to a company. They are
  left untouched but are no longer loaded by the scoped draft service.
- Local tests validate demo behavior, not server authorization, database isolation,
  live roles or resource ownership. Those are explicit later-phase release gates.

Roadmap: `SAAS_PHASE_PLAN.md`. Next: Phase 2 source-backed session/API compatibility audit.


## Phase 2: source audit and disabled read adapter

Status: local audit/adapter preparation complete. No live integration is enabled.

- TypeScript/Vite production build passed; all 22 tests passed, including 13 new fake-
  transport adapter tests. They cover disabled/no-credential behavior, exact GET query
  mapping, null stock, incorrect store/demo identity, backend's 100-row limit, missing/
  mismatched sessions, sanitized provider/HTTP failures, identity changes before and
  after requests, malformed/wrong-store/contradictory responses, startup readiness,
  two capability contracts, abort/network behavior, disable-during-session and invalid
  HTTP status. No automatic retries or fake successful empty reads.
- Static route extraction captured 210 literal declarations. SHA-256 fingerprints of
  35 reviewed source files were rechecked unchanged during the audit. The pre-existing
  modification to source `HARDWARE_CURRENT.md` was not changed by this task.
- Running UI/sample services were not changed. Built application asset hashes remain
  unchanged from Phase 1 (`index-DUlMEEAe.js`, `index-K8unNfBn.css`); integration modules
  are not imported into the runtime app. No repeat browser run was needed for this
  non-visual change. Adapter requests in tests use injected in-memory transport only.
- Original OmniPOS files, secrets/environment files, Supabase, SQL and deployments
  were not modified or operated. Source code and local tests do not prove deployed
  authentication, permissions, membership, database isolation or feature availability.

See `PHASE_2_BACKEND_CONTRACT_AUDIT.md` for the contract matrix and precise open gates.


## Continued local milestones and separate-frontend preparation

2 November 2026. Production phases 3–10 remain partial or gated; see
`IMPLEMENTATION_PROGRESS.md` for exact scope.

- TypeScript/Vite build passed; **39 Node tests passed**. New coverage includes session
  missing/inactive/onboarding/store states and late expiry, local team role/last-owner
  protection, product/stock scope, SKU validation, persistence failures, demo sale/reversal
  stock behavior, till requirements, one-time receiving/invoice linking, allocation
  replay/overpayment, corrupt nested/cross-tenant data, unknown valuation, all-or-nothing
  CSV import, CSV formula protection, and disabled public connection preparation.
- Desktop Chrome browser checks passed for local team creation, demo exit/paused reload/
  re-entry, product creation/reload/company separation, demo sale and account allocation,
  purchase/receipt/supplier-invoice chain, CSV import/download, role/tenant separation,
  and locally derived reports. Workflow browser run observed zero page errors and
  external requests. These are sample workflows only, not payment/database evidence.
- Additional browser checks confirmed escaped user-entered SKU text cannot become markup
  in the catalogue and that Connection setup cannot enable sign-in/API/posting.
- Desktop and 390px mobile screenshots inspected. Mobile report values now fit without
  horizontal scrolling; single-header DOM check passed. Wider ledgers deliberately scroll.
  Static app styling sweep clean. Required form fields are not styled as invalid before
  user interaction. Changed TypeScript files were formatted without changing built behavior.
- Read-only source inspection confirmed auth uses `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY`, relative authenticated API paths, and same-process hosting;
  no approved public target, external proxy/CORS setup or callback path was inferred.
- Public Supabase/MDN documentation was read; no customer Supabase project, dashboard,
  database, auth endpoint, deployment API or management service was contacted. No `.env`
  files were read, no actual credential values were obtained/disclosed and no old-project
  file was changed. Live auth/API/posting remain disabled under the user's instruction.

Limitations: browser storage is a local demo mechanism, not multi-user transaction
isolation or production authorization. No actual backend, installed authority, payments,
recovery/restore, billing, monitoring, deployment or signed-in pilot has been verified.

## Expanded local workflows (Phases 4–10 preparation)

2 November 2026. All implementation remains in this standalone repository. No original
OmniPOS files, secrets, live API/auth, Supabase or deployment were accessed or changed
in this milestone.

- `npm run check` passes: production TypeScript/Vite build and **48 passing Node tests**.
  Added tests cover category/unit rename/archive guards, customer snapshots and contact
  archive protection, quotation/order transitions and stable invoice conversion,
  multi-line partial receipts with dispositions and replay checks, allocation reversal,
  report paging/filter validation, same-scope snapshot restore/reference protection,
  and scoped owner-managed tenant requirements drafts.
- Headless local Chrome checks passed for category/product/customer creation;
  quotation → accepted order → invoice → demo sale; multi-line partial receipt;
  allocation reversal followed by full sale reversal; report filtering/reset;
  snapshot download, preview and confirmed restore with restored stock; and tenant
  requirements save/reload/download. Desktop and 390px layouts were checked; no
  page errors or external requests were observed. Runs used isolated sample browser
  contexts. These checks provide no live payment or backend evidence.
- Desktop screenshots of partial purchasing, inventory report and tenant requirements
  were inspected. Responsive report and invoice footer checks passed. The local styling
  sweep reported no findings. Changed TypeScript was formatted with the TypeScript
  printer and rechecked.
- Added a GitHub Actions check using pinned official checkout/setup-node v7 commits
  and Node 24. It installs the lockfile and runs `npm run check`; no secrets, posting
  or deployment job. The workflow has not yet run on GitHub. Official action sources:
  [checkout](https://github.com/actions/checkout) and
  [setup-node](https://github.com/actions/setup-node). Public action tags were verified;
  no customer project or Supabase endpoint was contacted.

Remaining limits: production phases 3–10 remain partial/gated. No server-enforced tenant
security, real provider sign-in, financial posting, RFQ/GRN/payable authority, partial
sales refunds, billing/provisioning, monitoring, production recovery or pilot release
is claimed. Snapshot restore is only for healthy local business storage and excludes
team/settings, quotation/order documents and saved invoice drafts. Local report paging
bounds displayed rows, not server reads. See the current progress matrix for details.

## Isolated existing-auth/product connection preparation

3 November 2026. Added a separate `/connection.html` screen, official auth SDK,
strict browser request boundaries and two GET-only Vercel functions for the existing
startup/product contracts. No direct database SDK call, table/RPC access, business
write, migration, seed, transaction proxy or changes in the original OmniPOS project.
The main invoice workspace continues to use sample data.

- TypeScript checks cover UI, tests, `api/` and shared server code. Multipage Vite build
  passes with environment-file loading explicitly disabled; no real key was loaded.
- **58 tests pass**, including ten new configuration/key rejection, proxy/no-store,
  response bound, consent, inactive/foreign identity, expiry, stale result, one-shot
  failure and SDK fake-fetch checks. All network dependencies in tests are fakes.
- Local connection UI was inspected: missing local configuration is shown, credentials
  and sign-in are disabled, and no auth/API request is triggered on opening the screen.
  Configuration exists only in Vercel; no actual local environment file was inspected.
- Public target values were previously inspected in the owner's Vercel UI; browser
  key stayed masked. Installation fetched the official npm package only, not any
  customer Supabase endpoint. No live sign-in, product GET or database call was made.

Still open: Vercel function deployment/routing, runtime/build public configuration,
issuer match, signed-in compatibility and production authorization. Ask before agent-run
live requests. Authentication itself creates provider session/audit activity; read-only
means no business-record writes. See `READ_ONLY_CONNECTION_CHECK.md` for exact scope.

## Deployed function import failure and local repair

3 November 2026. The owner's deployed connection screen loads and shows the expected
public target values without a configuration error. No credentials were entered by
the agent. An unauthenticated request to the new frontend's startup function returned
`500 FUNCTION_INVOCATION_FAILED`. Vercel runtime logs show `ERR_MODULE_NOT_FOUND` for
the extensionless `server/readOnlyProxy` import. The owner reported the same error.
This is module initialization failure before any handler/backend/database call.

- Both API entry imports now use `.ts`; TypeScript is configured to rewrite relative
  extensions in emitted JavaScript. This addresses both entries and their transitive
  `.ts` imports without changing request scope, auth, database configuration or records.
- A new regression test emits separate files using the actual project's TypeScript
  options, then starts the emitted handlers in plain Node. Before the fix it reproduced
  `ERR_MODULE_NOT_FOUND`; after the fix it passes. Both functions refuse missing-token
  GET with 401 and POST/PUT/PATCH/DELETE with 405 and no-store headers, with zero network
  calls. The earlier bundled-only verification hid runtime resolution differences.
- All **59 tests pass**. TypeScript and the frontend build also pass; Vite was run with
  environment-file loading disabled. No environment files or key values were read.
- Read-only inspection of original inventory source confirmed the balance route and
  exact-decimal/valuation contract, but no inventory proxy/adapter expansion was made
  while fixing this prerequisite. The inventory response omits row store/organization
  IDs after mapping; future decoders must not invent those as response evidence.

The repair remains local until published. Still required: deploy it, observe startup
401/JSON with no credentials, then verify owner-driven sign-in/products. No signed-in
connectivity, issuer matching, database behavior or production isolation is claimed.

## Read-only stock/invoice preparation and startup timeout diagnosis

3 November 2026. Deployed missing-token startup now returns `SESSION_REQUIRED`; Vercel
request logs show HTTP 401. The owner reported seeing sample data. Inspecting their
separate connection tab showed the startup read error, not live product results.
Vercel records that owner-started request as 502, duration 15.25 seconds, cache BYPASS.
This is consistent with the previous 15-second timeout; the underlying latency cause
is unverified. No credentials, environment contents or real business records were read.

Implemented a one-attempt 60-second proxy read / 70-second browser read, distinct safe
timeout diagnostics, first-page exact stock-balance view and owner/admin invoice
register. All allow-listed business routes remain GET-only, page 1 / limit 10, with
memory-only results and no automatic retry. There is no contact, seed, export, write,
transaction, billing, provisioning or database proxy. The main invoice app remains
sample-only. New functions use the repaired explicit-import/extension-emission setup.

All **71 tests**, TypeScript, and the environment-free production build pass. The
unbundled runtime test covers all four function entries and zero-fetch refusal of
missing credentials/write methods. Stock/invoice contracts, exact values, unknowns,
role/currency/scope/expiry, fallback rejection, safe UI escaping and diagnostics are
covered by fake responses. The stock view was inspected with synthetic layout data.
The new code has not been deployed, and no stock/invoice request was made live by the
agent. See `READ_PHASE_PROGRESS.md` for exact remaining gates and customer/supplier
contract limitations discovered through read-only original-source inspection.

## Authentication-stage diagnostics after owner sign-in failure

3 November 2026. Vercel Production confirms `0909dc0` Ready. The owner's already loaded
connection page still has product-only consent wording and a generic authentication
failure, before the new app has a usable provider session. This is distinct from the
previous startup API timeout. A fresh owner-driven attempt was requested; the agent
entered no credentials, read no token or environment values, and made no auth/API calls.

The frontend now preserves only known provider error codes and safe HTTP status in an
`AuthCheckError`; unknown messages/codes are suppressed. It shows authentication success
separately from loading the backend workspace. Provider sign-in still sends at most
one password-grant request with in-memory session only. No auth/database settings,
password, account, existing application or transaction behavior was changed.

All **75 tests**, TypeScript and the environment-free production build pass. New actual-
SDK fake-response checks cover code/status projection, no workspace call on auth refusal,
no leakage of fake private messages, SDK-computed expiry, accepted auth followed by a
backend refusal and rejection of malformed sessions before success/read. Real sign-in
remains unverified. See `SIGN_IN_DIAGNOSIS.md` for the exact owner handoff and limitations.

## Owner product confirmation and reusable read-only workspace

3 November 2026. The owner confirms seeing products from the selected existing store.
The agent previously observed the real authorized company/store selector. This is
owner-reported sign-in/startup/product success, not independent record extraction or
proof of all stores, roles, writes or database isolation. Earlier failures remain
historical; no causal fix is claimed without evidence.

Prepared `/workspace.html` with a 15-minute/provider-expiry memory session, explicit
store and view selection, manual search/pages of 10, and startup revalidation before
each selected data read. No persistence, refresh, prefetch, polling, retries, sample
fallback, exports or write operations. Switching stores/views, logout, expiry and
page navigation clear results. The one-read diagnostic remains available separately.

All **85 tests** pass, including ten new workspace cases for inert/consent state,
scoped multi-view queries, revocation/company/type/role changes, stale responses,
expiry, concurrency, invalid queries, later-page metadata, logout during auth and
failed-read cleanup. The unbundled runtime test covers the shared query-boundary
imports. TypeScript and the environment-free three-entry production build pass.
Local workspace UI was inspected without sign-in: local config is absent, the form is
disabled, and no automatic auth/API read occurs. Static style sweep clean.

No actual environment file, key value or live business records were read by the agent.
No database or existing OmniPOS code was changed. The new workspace itself remains
local and has not been deployed or tested against a signed-in owner session. See
`LIVE_READ_ONLY_WORKSPACE.md` for source contracts, hosting steps and remaining limits.
