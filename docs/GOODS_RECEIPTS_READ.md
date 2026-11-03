# Phase 6: read-only goods receipts

Implemented locally on 3 November 2026, inside this new frontend only. This extends
Phase 6 purchasing with existing goods-receipt browsing; it does not complete live
purchasing, receiving, matching, supplier invoicing, returns or financial posting.

## Verified contract

Read-only inspection began with `HARDWARE_CURRENT.md` in the original OmniPOS project.
`routes/hardware/goodsReceipts.ts:25-115` and
`src/services/hardwareService.ts:872-940` define:

- GET `/api/hardware/goods-receipts` with `storeId`, `page`, `limit`, optional `search`.
- Owner/admin read gate, verified Hardware store, organization/store query conditions.
- Response `{success,data,total,page,limit,grnAvailable}`. Receipts carry organization
  and store IDs and joined supplier, purchase-order, location and product/line data.
- `grnAvailable:false` means unavailable capability, not zero receipts. This frontend
  displays that distinction and uses null counts/pages internally. No setup is attempted.
- Search matches GRN number or supplier delivery reference. The list already includes
  receipt lines; expanding them does not request another endpoint.

The new GET-only Vercel function uses the existing approved origin and five existing
public configuration values. No new key, secret, environment setting or backend change
is required by this code. Route availability in the deployed backend remains unverified.

## Frontend behavior

Select Goods receipts in `/workspace.html`, choose a Hardware store and click Load
records. Search and Next/Previous are explicit, ten receipts per page. Company/store,
active membership and owner/admin role are freshly checked before every business GET.
Both invoice and purchasing role gates exist in the service, beyond disabled buttons.

Only receipt references/dates, supplier name, purchase-order reference, location,
inspection/discrepancy status and recorded line quantities/unit costs are projected.
Contact details, receiver profiles, free-text notes and raw response payloads are not
retained in the result model or rendered. The existing backend still sends its joined
response; this is a frontend projection, not server-side data minimization.

Decimal strings are preserved. Finite non-negative numeric values are displayed as
returned numbers converted to text; original decimal precision cannot be recovered.
Null means unavailable. No accepted/damaged/quarantine totals or accounting values are
recalculated. Receipt and joined IDs, parent/store/company scope when supplied, duplicate
IDs, page completeness and statuses are validated. More than 200 joined lines in one
receipt fails explicitly without truncating a record. The existing 2 MB response limit
also applies. There is no persistence, export, mutation, receiving, posting or fallback.

Purchase orders remain unavailable in this live workspace: the original
`routes/hardware/purchaseOrders.ts:32-110` list has no bounded paging/search contract.
No imaginary parameters or unbounded fetch were introduced. Supplier/customer directory
gates and authoritative tenant isolation remain in `READ_PHASE_PROGRESS.md`.

## Verification

90 tests pass, including new receipt projection/decimal preservation, unavailable versus
empty results, scope/parent/join mismatches, duplicate IDs, oversized or incomplete pages,
malformed quantities, safe HTML, bounded query generation and freshly revoked role.
The unbundled plain-Node function test now includes all five real API entries and rejects
unauthenticated GET and POST/PUT/PATCH/DELETE without any network call. TypeScript and
production build pass with environment-file loading disabled.

The shared receipt view was also inspected in a local browser with clearly labelled
sample records, including expanding its lines. The temporary visual harness was removed.
All automated reads use fake transport. No authenticated live request, Supabase operation,
actual environment-file read or original-project modification was performed.

## Deployment check for the owner

After pushing this milestone and Vercel finishes deployment, open `/workspace.html` and
sign in privately with your existing account. Select your Hardware store and Goods
receipts, then Load records. Check that known references/inspection/line quantities agree
with existing OmniPOS, and verify page/search behavior if enough records exist. No new
receipt should be created. An unavailable message needs backend-owner review, not a
migration performed by this frontend. Report only success or a safe error code/status;
do not send credentials or business records.

This signed-in deployment check remains outstanding. No production purchasing or tenant
isolation certification is claimed.
