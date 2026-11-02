# Prototype verification

2 November 2026, local prototype only.

- TypeScript check and Vite production build passed.
- Two Node tests passed: product search/barcode/pagination/cancellation/store guard/
  fixture isolation; KWD sample rounding, discounts, charges and empty totals.
- Headless Chrome exercised quantity recalculation, search/add, local draft save,
  reload/restore, catalogue search, charges and mobile page overflow at 390px.
  No page errors or non-local requests were observed.
- Desktop (1440px) and mobile (390px) full-page screenshots inspected in-thread.
  The wide editable ledger deliberately scrolls horizontally on small screens.
  Screenshots are generated in ignored `artifacts/`.
- Hallmark static app sweep: 0 FAIL, 0 REFLEX, 0 WARN. Its own render tier could
  not run because puppeteer-core is absent; Chrome checks above used bundled
  Playwright instead. No independent agent review was performed.

Not verified: live API, auth/tenant/store/staff authorization, payments, stock,
accounting, tax, database compatibility or a packaged desktop runtime. None are
connected in this prototype. No OmniPOS source modifications or Supabase operations.


## Screenshot completion pass

The local build and existing tests passed again. Headless Chrome verified all
14 invoice sections, the expanded grid header, F5 and Ctrl F5 routing, arrow-key
tab navigation, inline sample history, gross/net recalculation, local draft
save/reload/restore, nested Purchase navigation, customer filtering, Finance links,
and mobile menu navigation/overflow at 390px. No page errors or external requests
were observed. Desktop, settlement and mobile screenshots were visually inspected.
New sample panels and menus are design previews; no live contract was added.


## Purchase cascade pass

Verified seven screenshot categories and three-level menu nesting in headless Chrome:
hovering each branch preserves its Purchase ancestor; registers open and survive reload;
keyboard arrows reach the third level; Escape returns one level; new-document previews
keep saving disabled; mobile tap navigation reaches Supplier invoices at 390px without
page overflow. Zero browser errors and external requests observed. The cascade screenshot
was inspected visually. New document layouts are provisional frontend previews only.


## Purchase invoice voucher menu

Headless Chrome opened all 11 screenshot destinations and verified their page titles,
disabled posting, desktop submenu fit, direct-URL restoration, receipt-source/import
layouts and mobile navigation to Proforma at 390px. Zero page errors or external
requests observed. Menu and receipt/import screenshots inspected visually. Build,
existing tests and static styling checks pass. No backend integration was performed.


## Phase 1: tenant-aware sample foundation

Status: sample frontend foundation complete; production multi-tenant security is NOT
implemented or verified. No authentication/backend/database connection exists.

- TypeScript/Vite build passed; nine Node tests passed, including seven new tenant
  tests for membership tuples, bound catalog scope, tenant/branch draft separation,
  corrupt/copied envelopes, legacy draft non-adoption, invalid lines/products,
  scoped customer/history fixtures and invalid remembered context.
- Headless Chrome exercised two companies and three stores: company/store-bound
  catalogue/customer/register views; cleared search and undo on switching; preserved
  unsaved drafts per workspace in page memory; distinct local save/reload/restore;
  validated tab selection restore; mobile nested menus and voucher branch context.
- Zero browser errors and non-local requests observed. Desktop and 390px mobile
  screenshots inspected. Static app styling sweep clean. Existing invoice/purchase
  previews remain functional; posting remains disabled.
- Old unscoped v1 browser drafts are not migrated or assigned to a company. They are
  left untouched but are no longer loaded by the scoped draft service.
- Local tests validate demo behavior, not server authorization, database isolation,
  live roles or resource ownership. Those are explicit later-phase release gates.

Roadmap: `SAAS_PHASE_PLAN.md`. Next: Phase 2 source-backed session/API compatibility audit.
