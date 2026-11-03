# Live read-only Hardware workspace

Prepared 3 November 2026 in this new project only. The owner has confirmed successful
existing-account sign-in, store selection and a real product read using the deployed
connection check. This is owner-reported product-read evidence; the agent did not fetch
or copy the product records. The agent separately observed the authorized store selector.
No database, schema, account or original OmniPOS changes were made.

## Next phase delivered locally

`/workspace.html` turns the isolated one-read probe into a separate operational read-only
workspace. It uses the same five public Vercel settings and existing API routes. No
additional environment variable, database secret or backend change is required by this
implementation. Settings → Connection setup and the diagnostic page link to it.

- Sign in once, explicitly consenting to manual read-only browsing. The token stays
  in this page's memory for at most 15 minutes or the provider expiry, whichever is
  earlier. There is no silent refresh, session persistence, token transfer or global
  sign-out. Reloading/signing out/expiry/navigation clears the session and records.
- Choose a Hardware store from the authenticated company context. Company is read-only;
  the current backend supports one organization per profile, not a new company-switch API.
- Browse Products, Stock balances, and the owner/admin Invoice register, Goods receipts, Supplier invoices, Supplier returns and Purchase rate differences. Selecting a
  view or store clears results and does not automatically load data.
- Search explicitly with Load records. Previous/Next also require a deliberate click.
  List pages request 10 records. The rate-difference report pages by 10 qualifying
  invoices, with a variable number of returned lines and no search. The maximum page is 10000; search is capped at
  120 characters with conservative literal letters/numbers/basic code punctuation.
  These are frontend/proxy limits, not invented backend pagination parameters.
- Each manual data read first re-reads `/api/startup-context` to check active profile,
  company/store and role, then makes exactly one selected data GET. A denied/failed/
  expired/mismatched read clears this workspace session instead of substituting demo
  data or zero balances. No automatic retry, prefetch, polling or background API call.
- Stock quantity/cost/value strings remain exact; null stays unavailable. Invoice
  amounts are shown as returned without calculating net revenue, profit or balances.
  Metadata/counts/pages and duplicate product IDs are checked. An empty later page is
  described as an empty page/search, not proof that the store has no records.

The main editable invoice application remains a separate sample workspace. No live
records are imported into its sample invoices, drafts, adjustments, exports or snapshots.
There are no live edit, create, receive, checkout, refund, payment, export or provisioning
controls here. The one-read `/connection.html` diagnostic remains available and retains
its one-data-read-per-sign-in rule.

## Verified existing source contracts

Read-only source: `/Users/naveedhanif/Codex projects/multistore-application--main`, HEAD
`b1e70d8dc52cb980a9c6cbf056ac24d0bb794930`; began with `HARDWARE_CURRENT.md`.

| View | Route | Source behavior reused |
| --- | --- | --- |
| Products | `/api/hardware/products` | `src/services/hardwareService.ts:147+`, `routes/hardware/products.ts`, `hardwareProductsRuntime.ts:25-38`: `storeId`, `page`, `limit`, `search`; count and total-pages response. |
| Stock balances | `/api/hardware/inventory/balances` | `routes/hardware/inventory.ts:165-293`: `page`, `limit`, `search`; exact decimal strings and explicit valuation availability; pagination block. |
| Invoice register | `/api/hardware/sales/invoices` | `routes/hardware/sales.ts:583-863`: active owner/admin gate, company/store-scoped query, page/limit/search, count; excludes voided invoices. |
| Goods receipts | `/api/hardware/goods-receipts` | `routes/hardware/goodsReceipts.ts:25-115`: active owner/admin gate, organization/store checks, page/limit/search, explicit `grnAvailable`; joined receipt lines. |
| Supplier invoices | `/api/hardware/supplier-invoices` | `routes/hardware/supplierInvoices.ts:331-411`: owner/admin, organization/store, page/limit/reference search; server-owned feature gate. |
| Supplier returns | `/api/hardware/supplier-returns` | `routes/hardware/supplierReturns.ts:246-341`: active owner/admin gate, organization/store query scope, page/limit/reference search; read availability independent of write flags. |
| Purchase rate differences | `/api/hardware/supplier-invoices/reports/rate-differences` | `routes/hardware/supplierInvoices.ts:553-678`: owner/admin, company/store scope, invoice-based page/limit; no search. |
| Workspace recheck | `/api/startup-context` | `server.ts:608-674`: authenticated profile, its organization and that organization's stores. |

The proxy still forwards only GET for those exact paths, fixed `limit=10`, validated
page and optional search. Unknown parameters, duplicate keys, broad path forwarding,
write methods, bootstrap/seed and unrelated reads are refused. Cookies are not forwarded;
responses remain private/no-store. Vercel functions use explicit imports and are covered
by the plain-Node unbundled runtime test. Both read-only HTML pages have the restrictive
connection policy in `vercel.json`.

## Verification and limits

- All **111 tests** pass; TypeScript covers browser/server/API code. The production build
  emits `index.html`, `connection.html`, and `workspace.html`, with environment-file
  loading explicitly disabled during verification. No real key was read by the agent.
- Ten workspace tests cover inert/consent state, real-scope selection/deselection,
  manual multi-view search/paging, startup rechecks, inactive/company/store/role changes,
  stale responses after switching, absolute/provider expiry, concurrent-request refusal,
  invalid queries, safe result rendering, logout during auth and failed-read cleanup.
- Existing tests continue covering the one-read probe, auth diagnostics, source contracts,
  GET-only proxy and unbundled function loading. All networking in automated tests uses
  fake responses; no Supabase/database connection was operated by the agent.
- Local page inspection shows missing local configuration and disabled sign-in, with
  no automatic read. The configured session/browsing lifecycle is exercised with fake
  transport; the new workspace itself has not yet been deployed or live-verified.
- Backend product/stock handlers still read/enrich more rows than the returned page.
  Ten displayed rows do not prove server scalability. Search follows each existing
  route's semantics, not a new exact/global search authority.
- Client workspace rechecks are not server authorization. The existing backend's
  inactive-profile/granular store-membership gaps remain under owner review. Direct
  bearer requests still require authoritative backend isolation. No production security,
  revocation, recovery, devices or full operational rollout is claimed.

## Deployment and owner check

Push this new frontend milestone to the linked main branch. Existing Production values
in Vercel remain sufficient; no Supabase setting change or migration is requested.
When the deployment is Ready, open `/workspace.html`, sign in privately, choose the
existing store, and load products. Then verify search/Next/Previous, store switching,
stock balances, permitted invoices and goods receipts. Stop on a safe diagnostic rather than repeatedly
retrying. Only report success or code/status—never credentials or business records.

The agent has not committed/pushed/deployed these changes or performed a signed-in
live request. Real checkout/posting and other production phases remain gated by the
current no-write authorization and exact backend authority.

The goods-receipt extension preserves unavailable capability separately from empty
results and checks receipt company/store scope and joined IDs. It rejects malformed
or oversized (over 200 lines per receipt) results without truncation. Receipt details
expand locally from the existing list response; no detail or write route is enabled.
See [goods-receipt contract](GOODS_RECEIPTS_READ.md).

The supplier-invoice register adds recorded references, dates, posting/matching status,
procurement mode, currency and total. It calculates no payable/payment balance. Known
AP capability errors remain explicit. See [supplier invoice milestone](SUPPLIER_INVOICES_READ.md).

The supplier-return register preserves existing lifecycle wording without claiming
independent approval or received supplier credit. No write flags leave its decoder.
See [supplier return milestone](SUPPLIER_RETURNS_READ.md).

Purchase rate differences are server-calculated report values, with no local matching
or totals. Incomplete evidence stays unavailable and empty line pages remain distinct
from empty invoice populations. See [report milestone](PURCHASE_RATE_DIFFERENCES_READ.md).
