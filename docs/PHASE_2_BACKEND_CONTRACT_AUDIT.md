# Phase 2: backend and session contract audit

Status: **local source audit and disabled read-adapter preparation complete**.
Live integration, production authentication and tenant-security verification are not done.

Read-only source: `/Users/naveedhanif/Codex projects/multistore-application--main`.
Source HEAD at inspection: `b1e70d8dc52cb980a9c6cbf056ac24d0bb794930`.
`HARDWARE_CURRENT.md` was already modified at inspection; it is context, not release proof.
Inspected source files have SHA-256 fingerprints in `HARDWARE_ROUTE_INVENTORY.json`.
No source-project files were changed. No secrets, environment files, live services,
Supabase clients, SQL, migrations or deployment commands were used.

## 1. Verified identity and session contracts

| Concern | Source contract | Integration consequence | Evidence |
| --- | --- | --- | --- |
| Account sign-in | `supabase.auth.signInWithPassword({email,password})`; signup uses `signUp`. | There is no verified custom `/api/login` contract here. Do not invent one or install/connect a provider in this phase. | `src/components/auth/AuthScreen.tsx:15-25` |
| Session token | Existing service obtains `supabase.auth.getSession()` and sends `Authorization: Bearer <access_token>`. | Token provider must stay separate from API decoders; no tokens in URLs, browser drafts or error diagnostics. | `src/services/hardwareService.ts:28-38`, `src/contexts/AppContext.tsx:265-280` |
| Backend caller | Token validated by `auth.getUser(token)`; profile read from `core.users` by authenticated user ID. | Organization and caller role derive from the authenticated profile, not an organization header or a selector. | `server.ts:145-162` |
| Startup | `GET /api/startup-context` returns `{user,profile,organization,stores}`. Null profile/organization and empty stores are valid onboarding states. | Do not interpret every 200 as ready-to-operate. Require active matching profile, organization, and selected Hardware store. | `server.ts:608-671`, `src/types/index.ts:11-38` |
| Organization membership | Startup reads **one** `profile.organization_id`, then all stores for that organization. | Current verified contract is one organization per authenticated profile. Two demo companies do not prove multi-company membership. | `server.ts:627-661` |
| Store ownership | `verifyHardwareStore` reads the store and compares its organization with the caller profile. | Query/body store IDs still need server validation. This helper alone does not establish per-user store assignments or Hardware business type. | `server.ts:3638-3652` |
| Staff identity | AppContext lists active `core.users` for the current organization and retains selected staff per store. `POST /api/auth/verify-pin` accepts `{userId,pin}` and returns `{success:true}`. | A selected staff object is not a new authenticated account or signed staff session. Do not send invented `x-staff-id` authority. | `src/contexts/AppContext.tsx:91-143`, `server.ts:499-584`, `src/components/shared/StaffSwitcherModal.tsx:70-89` |
| Operator attribution | Hardware checkout RPC parameters use `auth.profile.id` as cashier in reviewed paths. | Confirm staff-vs-session attribution before implementing a PIN operator flow in this app. | `server.ts:7431-7447` |
| Session lifecycle | Initial/sign-in loads context; same-user token refresh updates session; user change clears identity; sign-out clears state and aborts startup. | Invalidate reads, caches, unsaved state and permission context on identity changes. A client revision must also discard A→B→A stale responses. | `src/lib/appSessionLifecycle.ts:25-99`, `src/contexts/AppContext.tsx:393-434` |
| Existing cache boundary | Identity key includes organization/store/user/staff; transition clears queries before rendering. | New adapter compares all these identity fields plus a local invalidation revision. | `src/contexts/QueryIdentityBoundary.tsx:5-53` |
| Sign-out | Existing AdminLayout calls `supabase.auth.signOut()`. | No invented backend logout endpoint. Local demo selection is not a sign-in session. | `src/components/layout/AdminLayout.tsx:384` |

The `BackendProfile`, `StartupContext`, `ReadIdentity` and `HardwareReadScope` types are
narrow projections for this integration. They are not copies of every existing row or
an added membership schema. `revision` is local invalidation state, never sent to the API.
Startup decoding drops raw user metadata and any unneeded profile fields.

## 2. Role and capability differences

There is no single verified universal capability map across all Hardware routes:

- Sales registers and Purchase read gates require an **active OWNER or ADMIN** profile.
  Invoice-detail access differs: non-admin active users can receive a sanitized document
  for their own sale; it must not be replaced with a generic all-sales permission.
  Evidence: `routes/hardware/purchaseReadGate.ts:33-52`, `routes/hardware/sales.ts:28-32`.
- RFQ operations deliberately include OWNER/ADMIN/MANAGER, with active-profile and
  feature-flag checks. Evidence: `routes/hardware/supplierRfqs.ts:59-83`.
- Purchase Vouchers require active OWNER/ADMIN and a Hardware store owned by that
  organization for every request. Evidence: `routes/hardware/purchaseVouchers.ts:25-45`.
- Manager approvals depend on the action. Price override always requires its own approval
  path; an administrative role does not imply every action is automatically approved.
  Evidence: `server.ts:8511-8557`.
- The frontend label-print helper has local permission fallbacks. Those are presentation
  behavior, not authorization authority to reuse in a new SaaS app.
  Evidence: `src/lib/hardwarePermissions.ts:5-57`.

Receiving capabilities and tender precision capabilities are separate contracts:

| Endpoint | Response | Notes |
| --- | --- | --- |
| `GET /api/hardware/capabilities?storeId=…` | `{success,receivingMode,grnReceivingEnabled,grnReceivingAvailable,correlationId}` | Mode is `grn`, `basic` or `unavailable`; enabled does not prove available. Errors must not become a default writable mode. `server.ts:4898-5019`. |
| `GET /api/hardware/store-capabilities?storeId=…` | `{storeId,currency,fractionDigits,directTenderV3Enabled,splitPrecisionEnabled,storeCreditPrecisionEnabled}` | No `success` envelope. Handler has a USD/2 fallback when currency lookup is unavailable; do not treat that as verified store currency. `server.ts:6817-6878`. |

Feature flag **names** are visible in source; their deployed values were not inspected.
No capability read was performed. Before money operations, reconcile actual store settings,
capability results and installed server authority; never infer readiness from a local flag.

## 3. Implemented read adapter

`src/integration/hardwareReadAdapter.ts` implements only:

1. `getStartupContext()` → `/api/startup-context`.
2. `getHardwareProducts(storeId,params,options)` → `/api/hardware/products`.
3. `getHardwareCapabilities(storeId,options)` → receiving capabilities.
4. `getHardwareStoreCapabilities(storeId,options)` → precision capabilities.

It defaults to **disabled**, requires injected session/identity/transport ports, and has
no default `fetch`, SDK, API origin, credentials, proxy or UI import. Tests explicitly
inject in-memory responses and synthetic credentials. No code path in the running app
constructs an enabled adapter. The production bundle is unchanged by this audit.

Every operation is GET-only, validates selected scope before session/transport work,
rechecks identity after asynchronous work, supports AbortSignal, and never retries.
Same-user token refresh is a token-provider concern; a user/store/staff/revision change
invalidates an in-flight answer. Errors expose a safe classification, HTTP status,
validated code and correlation ID; raw backend messages, response bodies and tokens
are not retained on errors. A network failure never becomes an empty successful list.

Product queries preserve the reviewed search/page/limit and existing filter names.
Default limit is 50; the backend caps limits at 100, so this adapter refuses larger
values before dispatch (`src/lib/hardwareProductsRuntime.ts:23-38`). Responses preserve
null stock as unavailable. Nullable/string decimal fields are normalized for display;
this is not exact-money accounting or transaction authority. Full product editing and
financial mapping require their phase-specific contracts.

## 4. Domain route map and remaining adapters

`HARDWARE_ROUTE_INVENTORY.json` records **210 literal declarations** from the mounted
Hardware routers and selected shared auth/startup/staff routes, plus hashes of 35 reviewed
source files. The extractor is reproducible with:

```sh
python3 scripts/audit-hardware-routes.py \
  --source '/Users/naveedhanif/Codex projects/multistore-application--main'
```

It reads only `server.ts`, mounted Hardware route modules and an explicit list of relevant
session/service/type files. It does not execute them or read environment files. Literal
registration is not proof of runtime mount order, installed authority, safe payloads,
complete authorization or live availability. Dynamic registrations and non-Hardware
systems are outside this inventory. Later write adapters require endpoint-specific review.

| Frontend area | Located source routes | Mapping status |
| --- | --- | --- |
| Catalogue/categories/units | `/api/hardware/products`, `/categories`, `/product-units` | Product read adapter prepared; editing/other adapters deferred. |
| Customers | `/api/hardware/customers` and customer subroutes | Existing contracts located; list/detail/mutation projections deferred to customer phase. |
| Suppliers | `/api/hardware/suppliers` and subroutes | Existing contracts located; adapter deferred. |
| Inventory | `/api/hardware/inventory/{summary,balances,movements}`; `/api/hardware/inventory/post-stock[-bulk]` | GET vs posting authorities remain distinct; no stock write adapter added. |
| Sales | `/api/hardware/sales/invoices`, `/sales/:id/invoice`; `/api/hardware/checkout`, `/void`, `/refund` | Registers/detail/checkout/refund have different payloads and roles. No transaction adapter added. |
| Tills | `/api/hardware/till/{registers,active,sessions,x-report,z-report}`; `/till/{open,close,cash-movements,no-sale}` | Session and money posting remain deferred. |
| Enquiries/quotations | `/api/hardware/supplier-rfqs` and lifecycle subroutes | These are RFQ/quote workflows, not verified one-to-one equivalents of every screenshot menu. |
| Orders/receipts | `/api/hardware/purchase-orders`; `/purchase-orders/:id/receive`; `/goods-receipts` | Basic vs GRN receiving, evidence and feature flags must be preserved. |
| Supplier invoices | `/api/hardware/supplier-invoices` plus direct/receive/match routes | Capability/status and invoice creation/matching are separate. |
| Purchase vouchers | `GET/POST /api/hardware/purchase-vouchers`; `POST /purchase-vouchers/direct` | Standard POST uses camelCase `{storeId,invoiceId,postingDate,idempotencyKey}`. Direct POST uses `{storeId,invoice_id,posting_date,idempotency_key}`. Do not combine them. |
| Voucher register | `GET /api/hardware/purchase-vouchers` | Returns `{success,data,hasMore,candidate,postingEnabled,timezone}` with offset/invoice/voucher filters, not generic `{page,total}`. `purchaseVouchers.ts:93-112`. |
| Supplier returns | `/api/hardware/supplier-returns/{drafts,:id/submit,:id/post,sources}` | Separate lifecycle; do not substitute a sales refund. |
| Finance/trade | `/api/hardware/trade` subroutes, vault/cash-office routes | Specific atomic authorities, roles and outcome handling require later review. |
| Import/Excise/Proforma voucher variants | No dedicated variant contract verified in reviewed declarations | Keep frontend-only. No invented paths or tax/import behavior. |
| E-invoice, cheque/PDC, journals, production and transfer screenshot workflows | No corresponding complete end-to-end authority verified in this phase | Menu presence does not imply backend support. |

## 5. Gaps that gate production wiring

| Gate | Evidence / limitation | Needed action |
| --- | --- | --- |
| Organization switching | Startup exposes one profile organization. `/hardware/users` lists organization-linked users; it is not a membership-switch contract. | Phase 3 can match one organization per account. If one account must switch companies, the backend owner must provide an authenticated membership/switch authority and tests first. No endpoint is invented here. |
| Active-account enforcement | `verifyCaller` returns `is_active` without rejecting inactive profiles; reviewed product reads use that helper without a separate active-profile gate. Some other routers explicitly enforce it. | Backend owner must verify/enforce consistent active-profile rejection before production exposure; a new frontend check cannot repair direct API access. |
| Store assignment | Shared store helper checks organization only and does not check business type or per-user store membership. Startup returns all organization stores. | Confirm intended store-access policy; enforce assigned-store restrictions server-side if required. Frontend filtering is not security. |
| Staff authority | PIN verification returns success only; active staff is stored as frontend state; reviewed checkout attribution uses authenticated profile. | Define and verify operator attribution, staff revocation and any signed delegation contract before enabling PIN staff operation. |
| Invitations/recovery/multiple memberships | No complete verified HTTP lifecycle in reviewed auth/startup/admin files. Staff-create/update routes exist but are not automatically invitation/acceptance contracts. | Review intended auth-provider configuration and existing onboarding/admin ownership in Phase 3. Do not infer provider settings from source. |
| Deployment boundary | Existing service uses relative same-origin URLs; no separate-frontend API origin/proxy/CORS contract was verified. | Confirm approved deployment/API origin and authenticated transport before wiring. No arbitrary URL setting or proxy added. |
| Schema/feature/transaction authority | Source names RPCs/flags; installed versions, grants, database isolation and feature values were not inspected. | User-managed verification is required before corresponding writes go live. No SQL, migration or Supabase operation was performed. |
| Release evidence | Repository source and local fake-transport tests only. | Authorized live environment and role/tenant-negative tests are required before describing integration as production-ready. |

## 6. Handoff to Phase 3

Preserve the existing design. Build session state and administration around the actual
single-organization startup contract first; keep demo identity visually distinct. Use
account lifecycle events to invalidate workspaces and never trust locally stored staff or
role fields for server permission. Implement missing/invalid profile, inactive profile,
no-organization, no-store, unauthorized store and expiry states before enabling business
operations. Decide any multiple-membership extension explicitly with the backend owner.

Phase 2 makes no live request and does not require the user to run database work now.
The listed external prerequisites become mandatory when their live workflows are enabled.
