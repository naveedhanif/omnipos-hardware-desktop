# Render comparison pilot

Use the existing Render Hardware app as the reference and the desktop workspace as the second client. Both clients should show the same server-generated record ID for a single submission. Repeat a workflow with a separate reference only when testing the other client's entry form.

| Order | Workflow | Compare in both clients |
| --- | --- | --- |
| 1 | Create one standard draft LPO using an existing test supplier and SKU | Order number, draft status, supplier, quantity, unit cost, delivery date and notes |
| 2 | Edit the notes and delivery date of that same draft | Same order number, saved values after reload and revision history where available |
| 3 | Save and edit a disposable product | SKU, name and prices after reload in both clients |
| 4 | Post one test sale with an approved tender and till | Invoice number, line totals, stock movement and till or account effect |

Use an explicitly designated QA Hardware store and an authorized account. Record only the store label, test reference and pass/fail outcomes in the handoff. The first desktop write should be limited to draft LPO creation and editing. Sending, receiving and sale posting are separate workflows.

## Backend findings

The existing service submits LPO creation to POST /api/hardware/purchase-orders and edits to PUT /api/hardware/purchase-orders/:id. The checked-out backend at b1e70d8 uses create_purchase_order_atomic, then calculates approval and updates metadata. Because the create call precedes those later steps, a refusal or error after that call can leave a saved draft. Check the Render register after an uncertain outcome before submitting again. Confirm the deployed backend revision and its active-role and resource-scope rules before exposing desktop writes. The reviewed create and edit handlers call the shared organization store check.

For the first slice, verify a store-scoped supplier lookup and draft detail readback, confirm the allowed edit fields and require a server-side draft-state guard. Verify that an inactive or unauthorized operator cannot create or edit a draft. Exercise partial failure and repeated submission in QA before using business records.

Sales use POST /api/hardware/checkout with a store, basket, tender and idempotency key. Till requirements, operator attribution and stock and payment effects must be checked for the chosen QA workflow. Compare the posted invoice and stock movement before progressing to additional tenders.

## Kuwait desktop cash sale

The owner designated Kuwait for one test cash sale. The desktop screen should use the signed-in store ID, one existing SKU at its current price, quantity one and exact cash. The operator should review the basket and total before submitting. A store label alone is insufficient for routing because labels can repeat across organizations.

The reviewed checkout handler in backend commit `b1e70d8` requires a till session ID for cash. The active-till endpoint can return a demo fallback. The desktop must reject fallback results and verify that the till belongs to the selected store. Before enabling checkout, confirm the deployed handler enforces active operator permissions and that the atomic checkout operation validates till and product scope. The HTTP handler authenticates the caller and scopes the store to the organization, but that does not verify the installed database function's behavior.

Keep the same submission reference for a single attempt. If the result is uncertain, stop and reconcile the invoice before another submission. The pilot passes when one invoice appears in the desktop register and matches the stock and till movements in the existing system.

## Deployed checkout review — 3 November 2026

Render shows `ba2c9418a834a2cc1d2a8ad6987359f550da7ff6` live for `omnipos-hardware-pilot`. The desktop till-check commit `e222def` has a successful Vercel status. Signed-in till verification is pending.

At the live Render revision, `server.ts:163` reads the operator's `role` and `is_active` fields and returns the profile. The checkout handler at `server.ts:6945` checks the authentication result and the store's organization. It reaches checkout without an explicit active-operator or checkout-role check. This is an HTTP-layer gap. The deployed database function's internal protections and the configured checkout variant remain unverified.

Before exposing the desktop POST route, the backend owner needs to enforce active-operator and approved checkout-role checks before any checkout RPC. Test that an inactive or unauthorized operator is refused with zero checkout RPC calls. Confirm that the installed checkout variant rejects a foreign or closed till and a product outside the selected store. Verify that replaying the same submission reference creates exactly one sale, stock movement and till entry. Use the confirmed Kuwait store ID for the pilot once these checks pass.

Render deployment: https://dashboard.render.com/web/srv-d963t9urnols73coa13g/deploys

A proposed [checkout operator guard](patches/hardware-checkout-operator-guard.patch) applies to the reviewed Render source. It returns HTTP 403 before reading the checkout payload or calling the checkout RPC when the profile is inactive or the role is outside the proposed owner/admin/manager/cashier set. The role set matches the existing sales-document role vocabulary and needs confirmation against the backend's intended checkout policy. The patch applies cleanly to the recorded revision and its guard passed an isolated nine-case check. Backend route integration and the deployed database checks remain pending.

## Catalogue and purchasing rollout

The Desktop signed-in workspace adds manual Categories, Suppliers and Purchase
Orders reads alongside Products, Goods Receipts, Supplier Invoices and Supplier
Returns. Categories shows active records. Suppliers and Purchase Orders require
an active owner/admin. The proxy verifies the selected Hardware store with
startup context and projects the record ID, name or LPO number, and status.
These three upstream registers do not support page/search parameters. The
proxy applies the search and ten-row page to the returned list, subject to its
response-size limit. An oversized response fails the read.

The sample workspace supports entering and editing a product barcode, and
setting or editing the expected delivery date and notes on the same draft LPO.
It rejects LPO edits after a receipt, including one that accepted no units.
Sample receipts affect local stock only, and sample supplier invoice drafts
remain separate from live supplier invoice matching or return posting.

### Gates for live writes

| Slice | Reviewed OmniPOS contract | Evidence needed before enabling |
| --- | --- | --- |
| Categories and products | POST and PUT under `/api/hardware/categories` and `/api/hardware/products`. Category uses `storeId`, `name`, optionally `parentId`. Product uses `storeId`, `name`, `sku`, `barcode`, `category_id`, `unit_of_measure_id`, `cost_price`, `sell_price`, and the product options accepted by the route. | Verify deployed operator permission, same-store category/unit checks, duplicate SKU/barcode behavior under retries, and authoritative readback. The current product-units GET seeds defaults when empty. It is excluded from the Desktop read-only allowlist. A side-effect-free unit lookup or an explicit approved provisioning workflow is required. |
| Suppliers and draft LPO | Supplier POST/PUT under `/api/hardware/suppliers`. Standard LPO POST accepts `storeId`, `supplier_id`, `expected_delivery_date`, `notes`, and `items` containing `product_id`, `ordered_qty`, and `unit_cost`. LPO metadata edit uses PUT to the specific order with `storeId`, `notes`, and `expected_delivery_date`. | Verify deployed active-role and resource checks, supplier eligibility, draft-only update enforcement, and behavior on a refused or interrupted create. The reviewed create route calls the draft RPC before approval evaluation. A refused response can therefore leave a saved draft. |
| Receiving and supplier follow-through | POST to `/api/hardware/purchase-orders/:id/receive`; supplier invoices and returns have separate capability/approval routes. | Verify the selected store's receiving mode, approval and location scope, discrepancy representation, replay protection, and matching/return capabilities before permitting a post. Compare the LPO, receipt and resulting stock in Desktop and Render. |

Local tests use fixtures for the read proxy and sample service. Deployed
signed-in Kuwait reads and all business writes require separate verification.

## Desktop record saves

An active owner or admin can use the signed-in Desktop forms to create and
edit categories, products, and suppliers through the existing API. Product
creation uses the backend's default Each unit. Product edits preserve the
unit and other fields outside the form. The server verifies the selected
Hardware store and the returned record's identity. After an uncertain result,
the workspace asks the operator to reload the register and look for the
change before trying again.

Desktop checks startup scope before asking for the till status. Live LPO
creation, LPO editing, receiving, and cash posting remain outside the
Desktop save routes. The outstanding gates are the order creation and
status guarantees above, and evidence for the checkout function's till,
product scope, and replay behavior.

Desktop owners and admins can check an existing sale by its ID in the invoice
register. The receipt lookup checks the selected store and returns the recorded
reference, tender, status and total. It supports comparing a known sale after
checkout. A missing receipt does not prove that an attempt failed, and the
lookup does not enable checkout posting.
