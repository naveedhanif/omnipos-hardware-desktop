# OmniPOS Hardware frontend prototype

Standalone visual prototype inspired by the supplied desktop invoice screenshot.
All implementation lives in this folder. It does not connect to OmniPOS or Supabase.

## Run

```sh
npm ci
npm run dev
```

Use Node.js 24 or newer. Open the localhost URL printed by Vite. `npm run build` checks TypeScript and builds
`dist/`; `npm test` verifies integration guards, tenant isolation, session states, local workflows and calculations. `npm run check` runs both build and tests. The GitHub Actions workflow runs this check on main pushes and pull requests; it does not deploy.

## SaaS roadmap

The app is moving toward a multi-tenant Hardware SaaS product. See the
[phased delivery plan](docs/SAAS_PHASE_PLAN.md) and its release gates.
Phase 1 introduces a **sample** tenant-aware frontend, not production authorization.
Phase 2 adds the [backend/session audit](docs/PHASE_2_BACKEND_CONTRACT_AUDIT.md),
[source route inventory](docs/HARDWARE_ROUTE_INVENTORY.json), and a disabled read-adapter
layer tested with fake responses. The app still uses sample data and has no live transport.
The existing verified startup contract returns one organization per authenticated profile;
production multi-company membership must not be inferred from the demo switcher.

## Current local workflows

See [implementation progress](docs/IMPLEMENTATION_PROGRESS.md) for working demo flows
and remaining release gates. Product management, local contacts/stock adjustments,
demo sales/tills/full reversals, quotation/order conversion, multi-line purchasing and partial receipts, account
allocations/reversals, customer statements, filtered paged reports and CSV/snapshot tools now share tenant-scoped browser data.

Settings → Connection setup explains why live sign-in, API calls and posting remain
disabled. The [separate frontend connection audit](docs/SEPARATE_FRONTEND_CONNECTION.md)
records verified source behavior and exact missing public configuration. No API endpoint
has been approved by inference. Use sample data only; this is not production SaaS security.

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
  Registers open additional document tabs; unsupported workflows remain labelled previews.
- Live settlement/posting controls remain disabled. Local demo actions are labelled explicitly.
- Save draft writes browser localStorage only. Restore saved draft is explicit.
- Remove an item; Ctrl/Command Z outside text fields undoes the last add/remove.
- Print produces a sample draft preview, explicitly marked as unposted.

Fixtures are behind `HardwareCatalogService` in `src/services/`. Live transport is disabled; integration adapters are tested using fake transport only. The verified product contract subset and remaining backend gates are in
[API_COMPATIBILITY.md](docs/API_COMPATIBILITY.md). Customer choices are local sample contacts.
Sample invoices, totals, discounts and charges are illustrative, not accounting authority.
Storage is local to one browser origin; unsaved edits warn on leaving. Do not enter
real customer or payment data. This is a browser prototype, not a packaged desktop app.

## GitHub

Repository: [naveedhanif/omnipos-hardware-desktop](https://github.com/naveedhanif/omnipos-hardware-desktop).

For future updates from this project folder:

```sh
cd '/Users/naveedhanif/Codex projects/omnipos-hardware-desktop'
git status --short --branch
git add .github package.json package-lock.json src docs tests README.md
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
