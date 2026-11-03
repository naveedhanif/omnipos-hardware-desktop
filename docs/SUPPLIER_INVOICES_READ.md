# Phase 6: read-only supplier invoice register

Prepared 3 November 2026 inside the new Hardware frontend only. This purchasing slice
follows goods receipts. It does not complete purchasing or enable Phase 7 financial
posting. Owner-reported real sign-in/product reads remain the existing live evidence;
supplier invoice reads need their own signed-in deployment check.

## Verified source

The original OmniPOS repository was inspected read-only, starting with
`HARDWARE_CURRENT.md`; HEAD `b1e70d8dc52cb980a9c6cbf056ac24d0bb794930`.

- `server.ts:10131` mounts `/api/hardware/supplier-invoices`.
- `routes/hardware/supplierInvoices.ts:331-411` defines the list. It requires the
  active owner/admin purchase read gate, verifies the Hardware store, filters by
  organization/store, and supports page/limit/search. Search targets supplier invoice
  number and internal invoice number, not supplier names.
- The success shape is `{success:true,data,pagination:{page,limit,total,totalPages}}`.
  Empty results report zero pages. The frontend preserves that metadata and labels
  an empty page/search honestly. No fallback data or zero total is invented.
- `src/services/hardwareService.ts:1811-1828` matches those query parameters.
- The existing list UI and routes verify supplier/internal references, invoice date,
  due date, procurement mode, currency, total_amount, posting_status and match_status.
  A reconciled payable/payment-status contract was not verified. No guessed payment
  field, outstanding balance, paid amount, due classification or matching calculation
  is introduced here.
- `supplierInvoices.ts:96-108` gates the list using the server-owned
  `HARDWARE_AP_DRAFT_V1_ENABLED` flag. Disabled returns HTTP 503/AP_FEATURE_DISABLED;
  unavailable schema/functions return HTTP 503/AP_SCHEMA_UNAVAILABLE. Neither is a
  genuine empty invoice list. This project does not change that flag or database setup.

## Implementation

`/workspace.html` has a Supplier invoices tab for owners/admins. Reads are explicit,
ten invoices per page, with shared literal search/page validation. Every read first
rechecks active company/store/role, then requests one selected business endpoint.
Receipt and invoice read-only pages remain separate from editable sample workflows.

The new function `api/hardware/supplier-invoices.ts` has an explicit `.ts` import,
covered by the plain-Node unbundled runtime test. The shared browser/server allowlist
accepts only the exact list GET with storeId/page/limit=10/optional search. Detail,
capability, match validation and all write routes remain refused. It uses the existing
approved origin/configuration and private/no-store response policy.

The strict decoder checks pagination completeness/counts, duplicate IDs, returned
organization/store IDs, supplier join identity, ISO-shaped recorded dates, finite
numeric/decimal-text amounts and currency. Non-null invoice currency must agree with
the freshly authorized store. Null values stay unavailable; decimal strings are
preserved, finite numeric values are displayed as returned, without claiming recovered
precision. Nullable/absent descriptive fields are displayed as not recorded. New status
strings are displayed literally and never interpreted as permission to act.

Only register fields are retained. Raw lines, notes, contact fields and correlations
from successful bodies are discarded. The existing backend still sends its joined
payload; frontend projection does not establish server-side data minimization. Shared
2 MB response and memory-only session/clear-on-error rules remain in force.

For this exact list route and HTTP 503 only, the proxy preserves the two reviewed AP
capability codes and an optional UUID correlation reference. It discards raw upstream
errors, extra fields and unreviewed codes. The UI explains capability failure and
clears the workspace session, without retry or substitution.

## Verification and owner check

97 tests pass with fake transport, including supplier scope/currency/role rejection,
recorded decimal/status preservation, null versus zero, genuine empty results, malformed
pagination/money/dates/joins, safe rendering, bounded query policy, GET-only forwarding,
capability diagnostics and all six emitted API functions running in plain Node.
TypeScript and production build pass with environment-file loading disabled.

No real environment files, credentials, authenticated live calls, Supabase operations,
database changes, or original-project modifications were performed.

After pushing and Vercel finishes deploying, sign in privately at `/workspace.html`,
select your Hardware store, choose Supplier invoices and click Load records. Compare
known references/statuses/totals with existing OmniPOS. Check reference search/pages
if records exist. Stop on the capability diagnostic if unavailable; do not enable flags
or install database functions merely to bypass this read gate. Only report success or
a safe error code/status, never credentials or business records. No new frontend
configuration is needed by this milestone. This live check remains outstanding.

## Next gates

- Purchase orders and supplier lists need bounded read contracts before enabling them.
- `routes/hardware/trade.ts:196-255` returns an unpaginated trade-account list and can
  return demoFallback records. Do not treat that as verified bounded finance authority.
  Trade-account browsing, reconciled statements and payments need a separate contract
  review; no financial write is authorized here.
- Backend isolation, granular membership, live role/revocation checks and operational
  readiness remain open. Local tests do not certify production tenant isolation.
