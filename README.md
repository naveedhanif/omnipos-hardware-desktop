# OmniPOS Hardware frontend prototype

Standalone visual prototype inspired by the supplied desktop invoice screenshot.
All implementation lives in this folder. It does not connect to OmniPOS or Supabase.

## Run

```sh
npm install
npm run dev
```

Open the localhost URL printed by Vite. `npm run build` checks TypeScript and builds
`dist/`; `npm test` verifies search/pagination, sample-store isolation and calculations.

## SaaS roadmap

The app is moving toward a multi-tenant Hardware SaaS product. See the
[phased delivery plan](docs/SAAS_PHASE_PLAN.md) and its release gates.
Phase 1 introduces a **sample** tenant-aware frontend, not production authorization.

## Try it

- Switch Company and Store in the header: Omni Hardware has two stores; Harbour
  Builders has one. Catalogues, sample customer views and drafts follow the selection.
- Unsaved drafts are kept separately in this page's memory while switching. Save/restore
  uses browser keys scoped by company, store and demo user. Reload loses unsaved edits.
- Legacy unscoped drafts are not automatically assigned to a company or restored.

- Open Transactions or Masters menus; switch Sales invoice / Item catalogue tabs.
- Search `drill`, `HW-1002` or barcode `629100000001`; press Enter to add the first match.
- Edit quantity, unit price and percentage discount. Tab moves between inputs.
- F2 searches; F3 Items, F4 Charges, F5 Batches, F6 Payable, F7 Receivable,
  F8 Cash, F9 Cheques, F11 Post dated cheques, F12 Cheques [PDC].
- Ctrl F3 Other info, Ctrl F4 E-invoice, Ctrl F5 Summary, Ctrl F6 Allocations,
  Ctrl F7 Notes. Ctrl/Command S saves locally. Browser/OS shortcuts can take priority.
- Scroll the invoice tab strip or use its arrows to reach every section. Arrow keys,
  Home and End move between focused invoice tabs.
- The grid includes cost rate, availability, sample batch flag, inline sample history,
  SKU/unit, quantity, landed-rate placeholder, unit rate, gross, discount and net.
  Scroll horizontally on narrower windows; landed rate is explicitly not mapped.
- Open nested Purchase, Sales, Inventory, Finance, General and Voucher menus.
  Purchase follows the reference: Enquiries, Quotations, Orders, Receipts, Invoices,
  Returns, and Purchase rate differences. Each opens a new-document preview or register.
  Desktop menus support hover; keyboard Down/Up, Right/Left and Escape navigate the
  cascade. Small screens use stacked, tap-to-expand branches.
  Menu register pages open additional document tabs with design previews.
- New settlement entry fields and posting buttons are disabled by design. The
  frontend is being reviewed before functions and backend integration are added.
- Save draft writes browser localStorage only. Restore saved draft is explicit.
- Remove an item; Ctrl/Command Z outside text fields undoes the last add/remove.
- Print produces a sample draft preview, explicitly marked as unposted.

Fixtures are behind `HardwareCatalogService` in `src/services/`. No network adapter
exists. The verified product contract subset and remaining backend gates are in
[API_COMPATIBILITY.md](docs/API_COMPATIBILITY.md). Customer choices are local fixtures.
Sample invoices, totals, discounts and charges are illustrative, not accounting authority.
Storage is local to one browser origin; unsaved edits warn on leaving. Do not enter
real customer or payment data. This is a browser prototype, not a packaged desktop app.

## GitHub

Repository: [naveedhanif/omnipos-hardware-desktop](https://github.com/naveedhanif/omnipos-hardware-desktop).

For future updates from this project folder:

```sh
cd '/Users/naveedhanif/Codex projects/omnipos-hardware-desktop'
git status --short --branch
git add .gitignore package.json package-lock.json tsconfig.json index.html src docs tests README.md .hallmark
git commit -m "Update Hardware frontend prototype"
git push origin main
```

Review the changes before committing. These commands commit and push the new frontend
repository; they do not open a PR, perform a merge, deploy the app or apply database
changes. Dependencies, build output, screenshots and environment files are ignored.

## Purchase invoice voucher menu

Transactions → Purchase → Invoices contains all 11 screenshot options: standard,
Import, Excise, Cash, against Orders (standard/Import/Excise), against Receipts
(standard/Import/Excise), and Proforma. Each opens a separate frontend voucher
preview. Order/receipt variants include a source-selection layout; Import/Excise
fields are provisional. All entry, save, payment and posting controls remain disabled.
The earlier supplier invoice previews remain under Transactions → Vouchers.
