# Hardware API compatibility review

Read-only source inspection on 2 November 2026:
`/Users/naveedhanif/Codex projects/multistore-application--main`.
Started with `HARDWARE_CURRENT.md`, then the project instructions, package definition,
`src/services/hardwareService.ts`, `routes/hardware/products.ts` and `routes/hardware/sales.ts`.
No source files were changed and no secrets, environment files, database or network API were read.

## Verified subset used by the prototype

- `getHardwareProducts(storeId, params, options)` maps to `GET /api/hardware/products`.
  Query includes `storeId`, `search`, `limit`, `page`. The existing service additionally supports
  legacy positional arguments and category/supplier/stock/price/cost/SKU/active filters.
- The server returns `success`, `products`, `total`, `summary`, `page`, `limit`,
  `totalPages`, `coverage`, `correlationId`. This prototype consumes only the typed subset
  in `src/services/contracts.ts`. It is not a complete response schema.
- Verified product fields include `id`, `store_id`, `name`, `sku`, `barcode`,
  `cost_price`, `sell_price`, `uom`, `stock_qty`, `category`, `track_inventory`,
  `is_active`, `allow_decimal_qty`. `stock_qty` can be null when inventory coverage is unavailable.
- Source evidence: hardwareService.ts lines 148–184; products.ts lines 183–250,
  590–612. Fixture IDs and all business data are explicitly synthetic.

## Sales boundary

`getHardwareSalesInvoices(storeId,page,limit,filters)` uses
`GET /api/hardware/sales/invoices`, bearer auth and `x-store-id`; its response is
`{data,count,page,limit}`, not the product envelope (sales.ts lines 857–862).
Detail is `GET /api/hardware/sales/:id/invoice`.

Existing `checkoutHardware` posts to `/api/hardware/checkout` with `storeId`,
`basketItems` (`productId`, `qty`, `price`, `name`, optional `discount`,
`taxRatePercentage`), `paymentType`, `idempotencyKey`, and optional customer,
trade account, till, tax, tender and quote fields (hardwareService.ts lines 1278–1316).
This prototype DOES NOT call or simulate successful checkout.

`InvoiceDraft`, browser draft saving, sample customer options, document number,
reference, payment selection, notes, charges and discount calculations are local
view behavior. No invoice-draft write API was verified. Local percentage discounts
must not be mapped to checkout's `discount` until its semantics are reviewed.

## Remaining compatibility gates

- Full invoice creation/draft lifecycle and accounting workflow.
- Customer API shape, supplier invoices, purchase vouchers and purchasing contracts.
- Session/organization/store/staff identity, roles and capability gates.
- Active till and payment requirements, tax, currency precision and exact rounding.
- Discount semantics, availability, fractional quantities, negative-stock policy.
- Idempotency, failure/unknown outcomes, validation and authoritative server totals.
- Complete response types, partial coverage and API versioning.

A future HTTP adapter must implement the catalog port after reviewing authentication,
error handling and tenant boundaries. Do not import the old service unchanged:
it imports a Supabase auth client. No Supabase dependency, credentials, HTTP transport,
proxy configuration or live fallback exists in this project.

## Frontend-only expansion (2 November 2026)

The full screenshot tab strip and ledger columns are now present. Additional
menu destinations are navigation/design previews, not claims of backend support.
`sampleWorkspaceService.ts` supplies the local bills, cash, customer, batch and
history presentation fixtures. These are separate from the verified product port.
No additional API contracts were inferred or added.

- Cost rate displays the verified product `cost_price`.
- Product code displays `sku`; the reference image's SKU column carries units,
  so the prototype labels it `SKU / unit` and displays the verified `uom`.
- Landed rate is **Not mapped**; it is not replaced with cost rate or zero.
- Batch flags, batch references and opening-history entries are explicitly sample
  UI metadata, not verified product fields or actual stock movements.
- Discount percentage, discount amount, gross and net are local display calculations.
- Bills payable/receivable, cash, cheques/PDC, allocations and e-invoicing remain
  preview layouts. Their entry and posting controls are disabled. Provider, tax,
  settlement and accounting semantics require review before implementation.
- The two PDC views follow the screenshot labels. Their distinct business rules
  are unresolved and are called out in the second PDC panel.
- Production, transfers, adjustments, registers and settings menu entries expose
  frontend layouts only; menu presence does not establish backend capability.


Purchase navigation now contains a third level for a new-document layout and register
under each screenshot category. These are frontend destinations only, including direct
URL routing. No new Purchase contracts or backend capabilities were verified in this pass.


The Invoices menu now follows the 11 voucher variants in the latest screenshot.
`purchaseVouchers.ts` contains only screenshot-derived labels and frontend layouts.
Import, excise, cash, order/receipt matching and proforma fields are provisional;
no API fields, tax treatment, receiving behavior or posting semantics are asserted.
Previous supplier invoice previews are retained under Transactions → Vouchers.


## Tenant-aware sample boundary (Phase 1)

The sample catalog adapter is now created with a validated demo organization/store/user
context. `getHardwareProducts(storeId, params, options)` retains the verified subset of
the existing product port; its caller cannot read another sample store through the same
adapter. This is demo validation, not an authentication or server authorization contract.
Scoped draft envelopes are private frontend data and must never be submitted as checkout
requests. All sample registers and item metadata use the selected fixture scope.

No live membership/auth/role contract was inferred. Phase 2 must inspect the actual
organization/store/session/staff lifecycle and access checks before an HTTP adapter or
production sign-in is enabled. Unknown APIs stay unknown. See `SAAS_PHASE_PLAN.md`.
