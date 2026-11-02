# Implementation progress and remaining release gates

Updated 2 November 2026. The app remains **a local sample application**. All changes are
inside this new repository. Nothing has been deployed or connected to OmniPOS/Supabase.
"Working locally" below is not completion of the corresponding production phase.

## Milestone status

| Phase | Implemented and locally verified | Still open |
| --- | --- | --- |
| 1 | Company/store context, scoped services and drafts, switch cleanup, two companies/three stores. | Production tenant enforcement. |
| 2 | Source contract audit, 210 literal route declarations, disabled read adapters, fake-transport tests. | Confirmed target and live compatibility/security verification. |
| 3 | Provider-neutral session lifecycle with onboarding/inactive/missing-store/expiry states; demo sign-out/re-entry; local team roles, owner protection and company settings. | Real provider wiring, auth-state UI/provider integration, invitation delivery/acceptance, recovery and revocation tests. |
| 4 | Local product create/edit/archive, customer/supplier edit/archive/reactivation, editable category/unit lists, stock balances/movements and validated demo adjustments. Products feed the invoice search and scoped drafts. | Live CRUD, atomic count/transfer/receiving authority. |
| 5 | Local invoice snapshots, sample stock changes, duplicate-reference and oversell prevention, demo till open/close, cash/card/account simulations, full demo reversal, and quotation → accepted order → invoice flow. | Partial returns, real tenders/till authority, atomic checkout/refund, loyalty and unknown live outcomes. |
| 6 | Multi-line local purchase orders, partial receipts with accepted/damaged/rejected/quarantined quantities, receipt-reference replay checks, supplier invoice draft linked to a fully received order; owner/admin demo gate. | RFQ lifecycle, authoritative GRN/discrepancy handling, matching, source-traceable liabilities and voucher/return authority. Import/Excise/Proforma stay previews. |
| 7 | Local account balances and allocations; over-allocation refusal and replay protection by local reference; reasoned allocation reversal, customer statement, and retained reversal history. | Real trade ledger, payment authority, reconciliation, bills, cheque/PDC and journal contracts. |
| 8 | Locally derived sample reports, stock value unavailable when stock is unknown, print action, selected-store CSV export, bounded all-or-nothing sample product CSV import, local JSON snapshot download and preview/confirmed same-store business restore. Four registers have filters, 20-row pages and filtered CSV export. | Authoritative server reporting/pagination, complete reporting coverage, real import contracts, print devices and production backup/recovery. |
| 9 | Explicit SaaS readiness/control-plane boundary and disabled billing/provisioning controls. Company-scoped requirements draft with local JSON download. No invented plan, charge or entitlement. | Tenant provisioning, subscription/provider ownership, billing/webhooks, server entitlements and audited support authority. |
| 10 | Unit checks, browser flows at desktop/mobile sizes, corrupt-state rejection, CSV formula protection, no external-request verification, release-gate checklist, and a pinned build/test GitHub Actions workflow (not yet run remotely). | Independent security review, approved deployment, production recovery/restore, observability, production performance and signed-in pilot. |

**The full production roadmap is not complete.** Phases 3–10 remain partial or gated.
The user requested continued independent work; this milestone carries working local
flows forward without silently substituting them for real backend capabilities.

## How to exercise the local workflows later

- Settings → Team & roles / Company settings: local changes per company. Harbour
  Builders has a demo Manager role and cannot perform owner-only actions.
- Settings → Session & access: end/expire the demo session. No real credentials are
  collected. Real account controls remain disabled.
- Masters → Items → Product management: add/edit a product. Zero-stock products
  without open demo orders may be archived; fractional stock cannot switch to whole units.
- Customers / Suppliers: edit or archive local contacts. Categories and Units support creation, rename and guarded archive. Referenced catalogue entries cannot be archived.
- Transactions → Inventory: view balances/movements or simulate a delta adjustment.
- Sales invoice → **Record demo sale**: records a local immutable snapshot and adjusts
  sample stock. Account mode needs no demo till; Cash/Card simulations require one.
  No real sale, payment, stock write or accounting entry is sent to the backend.
- Transactions → Sales → Demo till / Sales register / Sales returns: review local
  records and simulate a full reversal. Reverse active account allocations first. Sales quotations/orders can be saved from the invoice, accepted, converted and loaded back into an invoice; this does not reserve stock.
- Transactions → Purchase → Orders → Purchase orders: create a multi-line demo order;
  receive partially and record rejected/damaged/quarantined quantities. Only accepted quantities increase sample stock. In Vouchers → Supplier invoices, link an invoice draft to
  a fully received order. This produces no GRN, payable or posted voucher.
- Transactions → Finance → Account balances: allocate part or all of an account
  invoice locally. Reusing the same reference/payload does not add another allocation. Reverse allocations with a reason; history remains visible. Customer statement shows local invoice/allocation evidence.
- Reports → Demo reports: figures derive from selected-store local records. They are
  not official profit, tax, stock valuation or reconciled accounts.
- Tools → Data & exports: sample product CSV import (100 rows / 500 KB maximum),
  CSV exports and local business snapshot download/restore. Restore needs a valid same-store preview and confirmation, refuses removal of products or sales referenced by saved orders, and leaves team/settings/quotations/saved invoice drafts outside the snapshot. No file is uploaded.
- Reports → Sales register / Purchase register / Inventory valuation / Supplier statement: search, date filters where applicable, 20-row pages and filtered CSV.
- Settings → Tenant setup draft: save sample requirements locally. This provisions nothing and changes no currency, subscription or access.
- Settings → SaaS readiness / Connection setup: see current external gates.

## Storage and security limits

These browser records are demonstration data, not trusted multi-user authority. They are
scoped by organization/store; drafts additionally include user identity. Local company
administration is shared across that company's sample stores. Every service validates
its demo context and stored payloads. Failed storage writes do not show successful updates.

LocalStorage can be edited by the browser owner and does not provide cross-device,
multi-user or cross-tab financial transaction isolation. Stored sample roles are not real
permissions. Local deduplication/reversal rules are not server idempotency or refund
proof. Never enter real customer, payment, supplier or confidential business data here.
Snapshots are local business demonstrations only, not a complete backup of the application. Restore requires healthy current storage; this is not corrupt-storage or disaster recovery. Stock dispositions are recorded locally without an authoritative GRN or quarantine inventory ledger.

The original mock APIs/types remain separate from the inert live integration ports.
No local demo command is mapped to a live transaction endpoint. Unverified workflows
remain previews or disabled rather than inventing backend contracts.

## Next live-integration gate

Read `SEPARATE_FRONTEND_CONNECTION.md`. The user has reauthorized read-only inspection of
relevant original source and non-secret configuration and explicitly kept sign-in,
live API calls and live posting disabled until target/configuration confirmation.
The audit identifies exact public values and owner-controlled locations; no endpoint is
approved by its presence in source, memory, screenshots or an earlier conversation.
