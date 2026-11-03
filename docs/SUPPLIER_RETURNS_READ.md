# Phase 6: read-only supplier return register

Prepared 3 November 2026 inside the new Hardware frontend only. This is the next
purchasing read slice, following goods receipts and supplier invoices. It does not
complete purchasing, finance, posting or production readiness.

## Verified existing contract

Read-only inspection began with `HARDWARE_CURRENT.md` in the original OmniPOS repo,
HEAD `b1e70d8dc52cb980a9c6cbf056ac24d0bb794930`.

- `server.ts:10150` mounts `/api/hardware/supplier-returns`.
- `routes/hardware/supplierReturns.ts:246-341` defines a list protected by the active
  owner/admin purchase gate and verified Hardware store. The query includes both
  authenticated organization and selected store, exact count, stable created_at/id
  ordering, page/limit and return-number search. Out-of-range pages are recounted.
- `src/services/hardwareService.ts:954-984` defines the camel-case list response and
  recorded lifecycle/source fields. The read projection does not return store or
  organization IDs. Frontend identity checks bind the request and reject stale results;
  they cannot independently prove server row isolation from omitted response IDs.
- Success is `{success:true,data,pagination:{page,limit,total,totalPages},
  draftActionsEnabled,postingEnabled}`. The source reports at least one page, including
  genuinely empty results. No fallback/partial-page data is accepted.
- The list read does not require write flags. Its flags describe server action
  availability, not authorization for this frontend. Both are validated as booleans
  then discarded; true flags cannot produce any write control or request.
- Missing returns capability is HTTP 503/HARDWARE_RETURNS_UNAVAILABLE. The exact-route
  proxy preserves that reviewed code and an optional UUID correlation reference only;
  raw errors and unrelated codes are suppressed. Unavailable is never zero returns.

## Operator semantics

Wording follows `src/lib/hardwareSupplierReturnWording.ts` in the original project:

| Recorded status | Display |
| --- | --- |
| draft | Draft |
| pending_approval | Submitted — awaiting posting |
| posted_credit_pending | Posted — credit pending |
| closed | Closed |
| reversed | Reversed |

Submission is not independent approval. Credit-pending records the stock-return stage,
not a received supplier credit or payable adjustment. The new register computes no
amount, credit, reconciliation or inventory quantity from those statuses.

The read view retains reference, supplier name, source kind/label, status, currency,
created and posted dates. It drops reason, notes, approved date, actor records and flags.
No contact or line data is requested by this list. Source/supplier null values remain
unavailable, and the direct-purchase receipt contract supplies no label; a GRN number is
never invented from a UUID. Unknown statuses or mismatched source kinds fail explicitly.

## Frontend and transport

Select Supplier returns in `/workspace.html`, choose an authorized store and click Load
records. Search matches return reference. Pages request ten records each. Every manual
read rechecks active company/store/owner-admin access, then makes one business GET.
Currency must match the freshly authorized store. There is no auto-fetch, retry, export,
persistence, source/detail fetch, draft creation, submission, posting or supplier credit.
The editable sample app remains separate.

The new Vercel entry uses an explicit `.ts` import, covered by plain-Node emitted-function
checks. Only the exact list route with storeId/page/limit=10/optional search is allowlisted.
The existing approved origin, five public settings, no-store headers, response size limit,
memory-only session lifetime and scope-switch cleanup remain in force. No new settings,
secret, backend edit, flag change or database installation is requested by this code.

## Verification and remaining check

104 tests pass, including return lifecycle wording, absent/direct sources, safe HTML,
server flags discarded, duplicate IDs, malformed status/source/dates/pages, scope and
currency mismatches, freshly revoked role, failed-read cleanup, GET-only exact routing,
route/status-specific safe capability errors and seven unbundled API entries starting
in plain Node with zero network calls. TypeScript and the production build pass with
environment-file loading disabled. Automated reads use fake transport only.

No real environment files or credentials were read. No authenticated live request,
Supabase operation, database change, or original-project edit was performed.

After this milestone is pushed and Vercel finishes deploying, sign in privately at
`/workspace.html`, select the Hardware store, choose Supplier returns, and Load records.
Compare known references/statuses with existing OmniPOS, then check reference search and
paging if records exist. An unavailable diagnostic needs backend-owner review; it must
not be bypassed by enabling writes or installing schema from this frontend. Only report
success or a safe code/status, never credentials or business records.

That signed-in deployment check remains outstanding. Purchase-order/supplier/trade lists
still need bounded contracts. Reconciled finance, posting authority, server tenant isolation,
role/revocation checks and pilot readiness remain separate gates in READ_PHASE_PROGRESS.md.
