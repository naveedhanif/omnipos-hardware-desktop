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
