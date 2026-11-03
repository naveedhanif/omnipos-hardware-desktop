# Phase 10 read-only pilot

Run this pilot against a Vercel deployment of the new Hardware frontend. Record the deployed commit, date and the result of each check as **Pass**, **Fail** or **Not run**. Keep test evidence to outcomes and the safe code or HTTP status shown in Connection diagnostics.

| Check | Expected result |
| --- | --- |
| Release identity | Vercel shows Ready for the commit under review. |
| Owner sign-in | An existing owner or admin signs in privately and sees the expected company and authorized Hardware stores. |
| Read views | Manually load Products, Stock balances, Sales invoices, Goods receipts, Supplier invoices, Supplier returns and Purchase rate differences. Compare available views with existing OmniPOS. Record backend capability failures separately from empty results. |
| Paging and search | Try Next and Previous where enough records exist. Try supported search fields. Purchase rate differences pages by invoice. |
| Scope switch | If the account already has two authorized Hardware stores, load a view in the first store and switch to the second. Results clear until a new manual read. |
| Restricted role | With an existing restricted test account, check that owner/admin views are unavailable. Record this as a frontend role check. |
| Session cleanup | Clear displayed records, then verify sign-out and reload each remove the workspace session and results. |
| Keyboard | Navigate tabs with Left/Right and Home/End. Confirm focus moves to results or status after a manual read. |

Open `/workspace.html` to run the pilot. Use accounts and stores already authorized for the exercise. Share only the result matrix and safe diagnostics, with credentials and business records kept private.

Local release checks cover every checked-in API entry. Each must start in plain Node, refuse anonymous reads and reject write methods before an upstream request. A new file under `api/` fails verification until it is explicitly reviewed and covered.

The signed-in pilot is pending. Server-side isolation across tenants and stores, recovery and posting authority require separate evidence before a broader release.
