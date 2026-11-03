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
