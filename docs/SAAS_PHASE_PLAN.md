# Hardware SaaS implementation plan

Started 2 November 2026. This standalone frontend will eventually reuse OmniPOS's
existing Hardware backend and database only after compatibility and isolation review.
The current app has no backend connection. A menu preview is not a completed workflow.

## Product and tenancy model

- A **tenant** is an organization/company, with its own stores, memberships, settings,
  business records, subscription and audit history.
- A **store** belongs to one organization. An authorized user may have access to more
  than one organization/store; access must be evaluated separately for each.
- The current frontend scope is organization + store + user. Staff/till identity and
  permission/capability changes must join the scope before staff-dependent workflows.
- Existing organization/store IDs and session contracts should be reused, not replaced
  with a parallel identity model or duplicate customer database.
- Tenant business administration and platform-wide subscription/support administration
  are different permission boundaries. Support access must be explicit and audited.

## Phases and release gates

| Phase | Deliverable | Verification required before completion |
| --- | --- | --- |
| 1 | Tenant-aware frontend foundation: explicit company/store context, sample service scoping, isolated browser drafts and switch cleanup. | Two-company/three-store browser checks, wrong-scope/corrupt-draft tests, no stale data or undo across a switch. Demo foundation only. |
| 2 | Existing backend/session compatibility audit and API adapters: map organization, store, membership, user/staff, roles, capabilities, auth lifecycle, errors and all required routes. | Source-backed contract matrix; no invented endpoints; identify user-managed prerequisites. Live wiring remains disabled until approved. |
| 3 | Authentication and tenant administration: sign-in/out, recovery, invitation/acceptance, company/store selection, membership lifecycle, role/permission UI, tenant settings. | Real session lifecycle, revoked membership, unauthorized organization/store and ID tampering tests against the authorized backend. Server-enforced checks on every request. |
| 4 | Product and stock operations: catalogue, categories, units, suppliers, prices, balances, movements and receiving. Add adjustments/transfers only with verified authority. | Tenant/store-scoped CRUD and reads; decimal/money validation; unknown-vs-zero handling; concurrency/stock authority and role tests. |
| 5 | Sales operations: customers, quotations/orders, invoice lifecycle, till sessions, cash/card/account tenders, returns/refunds and receipts. | Authoritative totals, tax/discount contracts, stock/payment atomicity, idempotency and unknown-outcome recovery. No live payment until the isolated environment is verified. |
| 6 | Purchasing: enquiries/RFQs, quotations, orders, receipts/GRN, supplier invoices, vouchers, source matching and supplier returns. | Exact existing contracts; quantity/cost/approval rules; partial receiving and discrepancy handling; authoritative matching/posting. Import/Excise/Proforma require explicit verified semantics. |
| 7 | Finance: trade accounts, payables/receivables, allocations, charges, cash/cheques/PDC and journals where supported. | Source-traceable balances, exact decimal money, currency rules, posting authority, reconciliation and duplicate/unknown-outcome tests. Unsupported workflows stay unavailable. |
| 8 | Reports and operating tools: sales/purchases, profit, valuation, statements, exports/imports, print layouts, document search and history. | Bounded server pagination and authoritative totals, tenant-filtered exports/printing, import validation, auditable results and measured performance. |
| 9 | SaaS control plane: tenant onboarding, plan/entitlement UI, subscription lifecycle, usage limits, billing status, audit and explicit support access. | Confirm ownership of the existing platform/billing authority; verified provider/webhook contracts, server-enforced entitlements, tenant suspension/recovery and audit tests. No duplicate billing system by assumption. |
| 10 | Production hardening and pilot: isolation/security review, accessibility, recovery, observability, deployment configuration, staged release and operator training. | Cross-tenant negative tests for every resource, files/exports/jobs included; backup/restore evidence, monitoring, warm/cold latency, end-to-end role coverage and signed-in pilot approval. |

Finish and verify one sub-phase at a time. Each phase may need several small changes;
passing local tests does not establish backend, database or production readiness.
Independent frontend work may continue while an external gate is documented.

## Phase 1 implementation record

- Explicit sample company/store switcher, two companies and three stores.
- Demo memberships labelled as demo; no real sign-in or security claim.
- Product adapters bind to a validated sample organization/store/user tuple. Existing
  product query arguments and verified response subset are preserved.
- Sample registers, customer options, batch/history views and voucher branch context
  bind to the same selected workspace.
- Draft keys include organization/store/user. Saved envelopes carry the same scope;
  mismatched scopes, unknown products and invalid line values are refused.
- Old unscoped v1 local drafts are intentionally not assigned to a tenant. They remain
  untouched in the browser but cannot be restored through the new scoped service.
- Workspace switching clears search results, catalogue state, open document tabs, undo
  and history; catalogue/search revisions discard late responses. Each workspace's
  unsaved draft is retained in this page's memory. Reload loses unsaved drafts.
- Tab-scoped demo selection is validated when restored. It is not authentication.
- All demonstration stores currently use KWD. Live currency, tax, locale, fiscal year
  and numbering settings must be resolved from authoritative store settings later.

See `VERIFICATION.md` for current evidence. Phase 1 is complete as a **sample frontend
foundation**; it cannot be described as production multi-tenant isolation.

## Boundaries and external prerequisites

All code changes stay in this repository. Current OmniPOS source inspection is read-only.
No secrets or environment files are read. No Supabase connector/CLI, database queries,
migrations, deployments or database repairs are performed by this agent. Needed database
work will be described precisely for the user, not silently bypassed in the frontend.
No production authentication, payment or posting will be fabricated by sample success UI.

The user has authorized the initial GitHub upload. Subsequent milestone changes are
left reviewable locally with exact publish commands unless another upload is requested.

## Security basis

Tenant identity in a browser is a selection hint, not authority. A future API must resolve
the authenticated membership, verify organization/store/resource relationships, scope
caches/files/jobs, deny by default and enforce permissions on every request. These are
release requirements, not claims about the current backend.

References: [OWASP Multi Tenant Security](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html)
and [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).
