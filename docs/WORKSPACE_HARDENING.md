# Phase 10: read-only workspace frontend hardening

Prepared 3 November 2026 inside the new Hardware frontend only. This is an independent
app-side milestone while finance/SaaS control-plane contracts and live verification
remain gated. It does not complete Phase 10 or certify accessibility/security.

## Behavior

- The seven read views share an accessible tab strip with one keyboard tab stop.
  Left/Right wrap across enabled tabs; Home/End move to first/last enabled view.
  Restricted views stay disabled and are skipped. Modifier shortcuts and normal Tab
  navigation are left alone. Selecting the already selected view retains its results.
- Each tab names/controls the selected panel. The panel is labelled by the selected
  tab, is keyboard focusable and reflects its busy state. Arrow selection remains
  local: it clears prior results and never loads records automatically.
- Rerendering restores focus to the selected tab/store. Sign-in moves focus to the
  store selector when successful; startup/failed-read/busy status remains reachable.
  Completed reads focus the labelled result region. Failed reads focus the safe status
  message. A skip link reaches workspace status. Offscreen focused tabs scroll into view.
- The existing absolute memory-session expiry is visible as local time with an ISO
  datetime attribute. This display does not extend the session or start a countdown,
  refresh, polling or background request. Reloading still signs out.
- Clear displayed records removes the page result reference and rendered records;
  it keeps the session/search open and focuses Load records. It sends no request,
  performs no export/persistence and does not change expiry. Sign out retains its
  existing behavior of clearing session/results and aborting pending requests.
- Long header/company content wraps on smaller widths. Focus outlines remain inside
  the horizontally scrolling tab strip. Mobile tabs retain a 44 px minimum height.

The helper has no service/transport dependency. It never grants backend authority.
All service-level role, membership, scope, currency, stale-response and expiry checks
remain in force. Eight GET-only API functions and their seven data routes are unchanged.

## Verification

116 tests pass with fake transport. New tests cover tab/panel relationships and one
keyboard entry, busy/role restrictions, wrap/Home/End, real event binding, disabled
clicks/keys, unmodified Tab/shortcuts, safe missing/disabled focus targets and session
expiry rendering without an extension mechanism. Existing service/proxy/session tests
continue to cover reads and no-write behavior. TypeScript, production build with
`envFile:false`, and diff whitespace checks pass.

A temporary local browser harness used the actual tab rendering/binding helpers and
clearly labelled sample panels, with no auth/API transport. Verified Right selects
Stock balances and retains focus, End reaches Purchase rate differences and retains
focus, and Tab enters its associated panel. The harness/tab was removed after checking.
This does not establish signed-in end-to-end operation, screen-reader certification,
mobile-device coverage or production accessibility conformance.

No new dependency, API route, configuration, auth flow, environment-file read,
authenticated live call, database operation or original OmniPOS edit was introduced.

## Source review and remaining gates

Read-only source inspection again began with the original HARDWARE_CURRENT.md.
`routes/hardware/inventory.ts:300-418` provides a paged movement response after fetching
and calculating the broader movement history with numeric running balances. It also
returns notes/user enrichment. This milestone did not enable that route or present its
running balances as a verified exact ledger. Bounded server processing, decimal/cost
semantics and permission policy need separate review.

Phase 7 bounded/reconciled finance, Phase 9 platform ownership/provisioning/billing,
authoritative backend tenant isolation, signed-in role/revocation/recovery, production
performance and pilot checks remain open. The roadmap is not production-complete.

After pushing and Vercel deploys, privately test `/workspace.html` using an existing
account: keyboard-select permitted views, manually load records, verify focus/status,
clear results and sign out. Check the displayed expiry against the session ending.
Do not change business records. That signed-in deployment check remains outstanding.
