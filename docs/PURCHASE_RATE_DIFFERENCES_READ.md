# Phase 8: read-only purchase rate differences

Prepared 3 November 2026 inside this new frontend. This reporting slice follows the
read-only purchasing registers. Phase 7 reconciled finance still needs bounded contracts;
no live financial or stock write has been enabled. No production phase is certified.

## Verified contract and source

Read-only inspection began with the original `HARDWARE_CURRENT.md`.
`routes/hardware/supplierInvoices.ts:553-678` and
`src/services/hardwareService.ts:1837-1882` define:

- GET `/api/hardware/supplier-invoices/reports/rate-differences` with storeId/page/limit.
  There is no verified search contract. This frontend rejects search before network,
  and the proxy rejects even an empty search parameter for this route.
- Active owner/admin read gate, verified Hardware store, organization/store-scoped query,
  match_status=discrepancy, posting_status=draft or pending_approval, stable created_at/id
  ordering and exact invoice count. The existing AP server flag also gates reads.
- `{success:true,data:{differences,pagination:{page,limit,totalInvoices,totalPages}}}`.
  Pages describe qualifying invoices, never flattened difference lines. Direct-purchase
  invoices contribute zero report lines. The backend may recount an out-of-range page.
- Line values/classifications are calculated by the existing backend match authority.
  `src/lib/hardwareSupplierInvoiceMatchAuthority.ts` defines the classifications. Missing
  PO/GRN or invalid evidence yields null comparison values, not zero placeholders.
- Unit-cost variance is a per-unit difference. Monetary line impact is a distinct
  backend value. No client calculation, summing, payable, credit or posted adjustment
  is derived from these fields.

Source HEAD remains `b1e70d8dc52cb980a9c6cbf056ac24d0bb794930`. The source was not changed.
The report omits returned organization/store IDs and line IDs. Authorization is bound
to authenticated startup, selected request scope and existing backend checks; those
omitted IDs are not invented as additional isolation evidence. Repeated product/line
values may be legitimate and are not deduplicated by guessed keys.

## New frontend behavior

The owner/admin Purchase rate differences tab appears in `/workspace.html`. Select a
store, then Load records. Previous/Next page deliberately by ten qualifying invoices.
Search controls are absent for this report, and page labels state invoice-based scope.
The result explains both the backend's total qualifying invoices and this page's
returned line count. An empty line page never claims all matching is complete or that
there are no qualifying invoices.

The read decoder validates response/page metadata, supported draft/submitted statuses,
classifications, decimal strings, dates and consistent metadata for each invoice. Distinct
invoice IDs cannot exceed this page's qualifying-invoice window; the number of lines
can exceed ten or be zero. More than 2,000 returned lines is refused explicitly without
truncation, in addition to the shared 2 MB response limit. This is a frontend response
budget, not a newly claimed backend line limit.

Complete-evidence numeric fields must contain decimal text. Incomplete evidence must
contain null for every comparison field; zero placeholders are refused. Strings remain
exact, negative differences remain signed, and unknown evidence stays unavailable.
Currency must match the freshly authorized store. Raw notes are dropped. The page
renders no edit, approve, validate-match, adjustment, posting or export controls.

Every manual report read first rechecks active company/store/role, then sends one GET.
The new exact Vercel function uses an explicit `.ts` import. No sibling report route or
generic proxy is exposed. AP_FEATURE_DISABLED/AP_SCHEMA_UNAVAILABLE are preserved only
as reviewed 503 capability codes, with optional UUID reference. Raw backend errors are
not exposed. Known capability failure clears the workspace session; no retry, fallback,
feature-flag change or schema setup occurs. Existing approved settings are reused.

## Verification

111 tests pass with fake transport. New tests cover many lines per invoice, empty lines
with a nonzero invoice count, out-of-range pages, incomplete evidence versus fabricated
zeros, decimal preservation, inconsistent invoice metadata, invalid status/date/currency,
response size budget, HTML escaping, role revocation, currency mismatch, no-search
routing, GET-only policy and safe AP capability diagnostics. All eight API entries are
covered by the emitted plain-Node runtime test with zero fetches. TypeScript and the
production build pass with environment-file loading disabled.

No environment file or credential was read. No authenticated live read, Supabase
operation, database change, or original-project modification was performed.

## Deployment gate

After committing/pushing this frontend milestone and Vercel finishes deploying, sign
in privately at `/workspace.html`, select the Hardware store and Purchase rate differences,
then Load records. Compare existing known discrepancy cases with OmniPOS. Check invoice
paging if records exist. An empty line page can be valid; inspect the invoice counts.
An unavailable capability message needs backend-owner review, not bypassing a server
flag. Report only success or a safe code/status without records or credentials.

That signed-in report verification remains outstanding. Full authoritative reporting,
backend isolation/performance, finance contracts, production pilot and every live-write
permission/authority remain separate gates in READ_PHASE_PROGRESS.md.
