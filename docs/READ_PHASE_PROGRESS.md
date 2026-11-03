# Read-only integration progress

Updated 3 November 2026. All implementation changes are in the standalone Hardware
frontend. Original OmniPOS source remains read-only. No database/schema changes or
business writes are authorized or implemented by this milestone.

## Current live evidence

- Owner deployed the earlier ESM repair (`3239eff`). An agent-opened unauthenticated
  startup URL now displays JSON `SESSION_REQUIRED`, rather than the Vercel import
  failure. The request-log UI records that GET as HTTP 401. No bearer token was sent
  and the guard returns before any upstream request.
- The owner's connection tab subsequently displays “Hardware refused or could not
  complete this read.” It has no product result. Vercel request logs show startup
  HTTP 502 at 13:26:26 Dublin time, execution 15.25 seconds, cache BYPASS.
- That duration closely matches the old 15-second proxy timeout. This is evidence
  consistent with an upstream read timeout, not proof of its cause or of wrong keys.
  No request body, password, token, environment file, or raw business records were read.
- The local mitigation allows a single 60-second upstream GET and a 70-second browser
  read, still with no automatic retry. Provider sign-in retains its separate 15-second
  limit. Timeout/refusal/invalid-response diagnostics now appear with safe status/code.
  This mitigation is NOT yet deployed or proven to resolve the owner's failure.
- The main editable workspace remains sample-only by design. Seeing its demo products
  does not establish successful live connectivity. Real reads stay in `/connection.html`.

## Implemented this milestone

The separate connection screen offers Products, Stock balances, and (for owner/admin)
Invoice register. Each check permits one deliberate selected business read after the
existing sign-in/startup sequence, with `page=1&limit=10`. Session/results are memory-only;
there is no live-record import into sample drafts or local business storage.

| View | Verified source contract | Local preparation | Live status |
| --- | --- | --- | --- |
| Products | Existing `/api/hardware/products` | Existing strict projection and proxy | Owner's startup gate still fails before products |
| Stock balances | `routes/hardware/inventory.ts:165-293`; `/api/hardware/inventory/balances` | Exact decimal strings, null/zero distinction, valuation/status checks, first-page decoder, proxy and display | Not deployed or read live |
| Invoice register | `routes/hardware/sales.ts:583-863`; `/api/hardware/sales/invoices` | Owner/admin UI/service gate plus existing backend gate, recorded totals only, first-page decoder, proxy and display | Not deployed or read live |

The stock and invoice responses omit row store/organization IDs after scoped queries.
The new frontend binds requests to the validated startup scope and trusts those
backend checks; it does not invent response IDs as proof of isolation. Stock rejects
contradictory scope IDs if supplied, mismatched currency, duplicate rows, malformed
exact text, invalid availability/status combinations and inconsistent pagination.
Invoice projection omits customer/contact/payment details and computes no profit,
net revenue or ledger balance. Numeric amounts are shown as returned without claiming
recoverable extra precision. Fallback/demo responses are not accepted as live evidence.

All four Vercel entry points have the unbundled plain-Node regression test. They refuse
missing-token GET and all write methods with no-store headers and zero upstream calls.
Only startup and the three exact first-page paths are allow-listed. Other reads,
filters, subsequent pages, exports, writes, bootstrap and seed remain unavailable.

## Source evidence and limits for the following milestones

Original source HEAD rechecked: `b1e70d8dc52cb980a9c6cbf056ac24d0bb794930`.
Read `HARDWARE_CURRENT.md` first, then only relevant route/service helpers.

- Customer list (`routes/hardware/customers.ts:16-193`) is a company-wide directory,
  capped at 500, with store-specific enrichment. The required `storeId` is not used
  to limit the base customer list or verified by `verifyHardwareStore` in this route.
  It has no page/limit response contract. Do not portray it as a complete paginated
  store directory or add guessed pagination parameters. Directory scope/permission
  policy and a bounded/minimal projection need review before enabling it here.
- Supplier list (`routes/hardware/suppliers.ts:587-663`) enforces owner/admin and
  organization/store checks but returns an unpaginated enriched list containing
  contacts/documents/contracts. It has no verified paged/minimal list contract. It is
  not added to this proxy. Any needed backend change is separate owner-approved work
  in the old project; this agent has not made one.
- Sales History root includes broad refunds/enriched data and optional demo fallback.
  This milestone uses the narrower bounded invoice-register route instead. The
  register excludes voided invoices and is not a complete sales/refunds report.
- Stock balance output is paginated, but the existing handler fetches all matching
  balances before paging. Ten returned rows do not prove bounded backend work.
- Role, tenant isolation, authoritative reports and the backend's existing inactive-
  profile/granular-membership gaps still require signed-in verification and owner
  policy decisions. Frontend gates do not fix backend authorization.

## Roadmap checkpoint

| Phase | Current state | Completion gate |
| --- | --- | --- |
| 1–2 | Sample tenancy foundation and source audit/adapters implemented | Live tenant enforcement remains unverified |
| 3 | Isolated existing-account sign-in/startup implemented; owner startup attempt fails | Deploy diagnostic/timeout mitigation; successful owner sign-in/startup; full session/recovery/invitation work later |
| 4 | Local catalogue/stock workflows; live-capable product and stock read screens prepared | Deploy and verify real reads; contact scope/bounds; CRUD/receiving authority needs write authorization |
| 5 | Local sales/till/quotation/order flows; owner/admin invoice read prepared | Successful live reads; real checkout/refunds/tenders remain prohibited |
| 6–7 | Local purchasing/receiving and allocation/reversal simulations | Exact contracts, authorized backend writes and financial authority; no live posting permitted |
| 8 | Local reports/exports plus selected stock/invoice read views | Authoritative complete reporting, paging, devices and performance evidence |
| 9 | Local tenant requirements draft/readiness only | Verified control-plane ownership, provisioning/billing contracts and explicit authority |
| 10 | Build, tests, local layout and unauthenticated deployed guard verified | Successful signed-in checks, deployment/security/recovery/pilot evidence |

**All production phases cannot be marked complete under the current no-write scope.**
Live data changes, provisioning, billing and release authority are not inferred from
“keep going”. Independent read preparation continues, but the owner's startup failure
must be resolved before presenting the app as connected or expanding live operations.

## Verification

TypeScript, production multipage build (with environment files disabled), and all
71 tests pass. New tests cover stock exact/unknown values, source request mapping,
wrong/stale scope, role/currency/expiry guards, invoice projection, refused writes,
UI escaping, timeout classification and safe diagnostics. The unbundled runtime test
covers every API entry. A stock-layout preview was inspected using synthetic data;
no live stock or invoice dataset was fetched by the agent.

Next deployment check: missing-token startup must remain 401/JSON; the owner then
performs a fresh sign-in and selected read, reporting only success or safe diagnostics.
Do not share passwords, keys, tokens or records. No server/database secret is required.
