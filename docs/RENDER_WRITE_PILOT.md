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
