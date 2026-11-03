# Read-only integration progress

Updated 3 November 2026. All changes are inside the new Hardware frontend. No database,
schema, account or original OmniPOS changes have been made.

## Current evidence

- The deployed import repair made missing-token startup return 401/`SESSION_REQUIRED`.
- The owner subsequently reached the real company/Hardware-store selector. The agent
  observed that selector without changing it or submitting a request.
- **The owner now confirms seeing the existing store's products.** This establishes
  successful sign-in/startup/product reading for that account/store as an owner report.
  It is not evidence for all stores, roles, write operations or database isolation.
- Earlier import errors, 15-second startup 502 and a generic authentication error are
  historical failures. Their ultimate causes are not all proven; do not describe the
  account as currently unable to sign in, or claim a particular mitigation caused success.
- The new memory-only, manually paged/searchable workspace is prepared locally at
  `/workspace.html`; it has not been deployed/live-verified. See
  [implementation and owner check](LIVE_READ_ONLY_WORKSPACE.md).

## Current read surfaces

| Surface | Implemented | Live evidence |
| --- | --- | --- |
| `/connection.html` | Existing sign-in/startup and one selected product/stock/invoice read | Owner confirms products; stock/invoice results not yet reported |
| `/workspace.html` | Reusable memory session, company/store context, manual products/stock/sales-invoice/receipt/supplier-invoice/supplier-return views plus purchase rate differences, paging/search, active context recheck before each read | New code remains local; 123 tests pass with fake transport |
| Main invoice application | Screenshot-inspired menus/forms/grid and local sample business workflows | Remains sample-only; no live records are injected into editable demo data |

All eight API functions remain GET-only, with authenticated startup and the seven
verified data paths. Fixed `limit=10`; pages 1–10000. Conservative literal search is allowed for list
views. Rate differences support invoice pages only, without search. Their invoice
counts must never be labelled as flattened line counts. The one-read probe itself still requests
only one first page. No writes, retries, polling, seed, bootstrap, contact queries,
exports or generic forwarding have been enabled.

## Following read contracts still need review

Original source HEAD rechecked: `b1e70d8dc52cb980a9c6cbf056ac24d0bb794930`.

- Customer list (`routes/hardware/customers.ts:16-193`) is company-wide, capped at 500,
  with store-specific enrichment. Its required `storeId` does not limit the base
  customer list and is not verified by `verifyHardwareStore` in that handler. There
  is no page/limit response contract. Directory scope/permission policy and a minimal
  bounded response need review before enabling it here.
- Purchase-order list (`routes/hardware/purchaseOrders.ts:32-110`) is owner/admin and
  store checked but has no pagination/search contract. Adding query parameters here
  would not bound that backend query. It stays disabled pending a bounded contract.
- Trade accounts (`routes/hardware/trade.ts:196-255`) are unpaginated and may return
  `demoFallback`. A bounded, authoritative finance-read contract is still needed.
- Supplier list (`routes/hardware/suppliers.ts:587-663`) enforces owner/admin and
  organization/store checks but returns an unpaginated enriched list with contacts,
  documents and contracts. No verified paged/minimal list contract has been added.
- Stock/product responses are paginated after broader backend batching/enrichment;
  UI paging alone does not fix server scalability.
- The stock and invoice projections omit returned organization/store IDs. Their reads
  bind to validated startup scope and existing backend checks; no response scope IDs
  are invented as evidence. Product rows do carry store IDs and are checked. The supplier-return register
  also omits scope IDs; its authorization is bound to the request/startup/backend.

No change to those original handlers was made or requested as part of this milestone.

## Roadmap checkpoint

| Phase | Current state | Remaining production gate |
| --- | --- | --- |
| 1–2 | Sample tenancy foundation, source audit and strict read adapters | Server-enforced tenant isolation verification |
| 3 | Owner-confirmed sign-in/startup; reusable read-only session prepared locally | Deploy/test new session UI; complete auth/recovery/invitations and revocation coverage |
| 4 | Owner-confirmed product read; stock browsing/search/pages prepared | Verify stock live; contact contracts; CRUD/receiving need write authority |
| 5 | Owner/admin invoice browsing/search/pages prepared; local sales/till/quotation flows | Verify invoice reads; real checkout/tenders/refunds remain prohibited |
| 6–7 | Local simulations plus owner/admin read-only goods receipts, supplier invoices and supplier returns | Verified posting/financial authority and later explicit write authorization |
| 8 | Local reports/exports plus read-only stock/invoice views and purchase rate differences | Complete authoritative reporting, performance and devices |
| 9 | Requirements draft/readiness only | Control-plane ownership, provisioning/billing contracts and authority |
| 10 | 123 tests, TypeScript/build and unbundled runtime checks pass; deployed guard verified | New deployment, signed-in role/isolation/recovery/pilot evidence |

The full production roadmap is not complete. The next phase can proceed with read-only
browsing without claiming live write functions work. Account/store/product data have
not been copied into this repository. Supabase and database operations remain the
owner's responsibility.

## Purchasing read milestone

The next Phase 6 slice adds owner/admin goods receipts to `/workspace.html`, with
manual search/pages and expandable recorded lines. It rechecks membership and role
before each read and validates returned company/store IDs. Missing GRN capability
is displayed as unavailable, not zero receipts. No receiving or posting is enabled.
See [contract, verification and owner check](GOODS_RECEIPTS_READ.md). This addition
has local test/build evidence only; signed-in deployment verification remains open.

## Supplier invoice register milestone

The next Phase 6 slice adds a read-only owner/admin supplier invoice register with
manual reference search/pages, recorded posting/matching statuses and invoice totals.
Scope, join, currency and pagination checks reject mismatches. Known AP-disabled/schema
diagnostics remain distinct from empty results; no flags or setup are changed. No
reconciled payable/payment-status contract was verified, so none is invented. See
[contract and owner check](SUPPLIER_INVOICES_READ.md). This addition has local checks
only; signed-in deployment verification remains outstanding.

## Supplier return register milestone

The next Phase 6 slice adds read-only owner/admin supplier returns with manual
reference search/pages, recorded source references/statuses/dates and currency.
Submitted status never implies independent approval; stock-posted status never
implies a supplier credit or payable adjustment. Server write flags are discarded
from the read model. No create, submit, post, detail or source-preparation endpoint
is enabled. See [contract and owner check](SUPPLIER_RETURNS_READ.md). This milestone
has local test/build evidence only; signed-in deployment verification remains open.

## Purchase rate differences milestone (Phase 8)

The first live-capable purchasing report reuses the existing owner/admin rate-difference
GET, manually paged by ten qualifying invoices. It preserves backend quantity, unit-rate
and monetary line differences without recalculating them. Missing/invalid evidence
stays unavailable. A page with no lines does not prove there are no qualifying invoices.
There is no search, export, matching validation or posting. See [contract and check](PURCHASE_RATE_DIFFERENCES_READ.md).
Local checks pass; signed-in deployment verification remains outstanding. Phase 7
finance remains gated by bounded, reconciled read contracts and write authority.

## Phase 10 frontend accessibility and session hardening

The read-only workspace now has roving keyboard tabs with Left/Right/Home/End,
labelled tab panels, restored focus after context changes/reads, visible session expiry,
a skip link, and a local Clear displayed records action. It adds no API route or
authentication capability. The same seven read data paths/eight GET-only functions
remain. Source inspection of stock movements (`inventory.ts:300-418`) found broader
backend batching and numeric running balances; it was not enabled as an authoritative
movement ledger in this milestone. Finance and SaaS control-plane gates remain open.
See [scope and verification](WORKSPACE_HARDENING.md).

## Phase 10 safe diagnostics and manual recovery

The read-only workspace now retains one in-memory, projected operation summary:
sign-in, workspace check or data read; outcome; known code/category; valid HTTP status;
and optional UUID correlation reference. Failures open the diagnostic panel with a
manual next step. Raw messages, credentials, business identities, search terms and
records are excluded. No telemetry, persistence, automatic retry or new API capability
is added. Unknown machine codes and arbitrary correlation/provider text are suppressed
in both the read adapter and visible errors. See [verification and limits](WORKSPACE_DIAGNOSTICS.md).
