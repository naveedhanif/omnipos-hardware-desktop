# Phase 10: safe diagnostics and manual recovery

Prepared 3 November 2026 inside this new Hardware frontend only. This is the next
independent frontend-hardening slice, not completion of Phase 10 or production rollout.
It introduces no new auth flow, API capability, posting or database operation.

## Operator behavior

The read-only `/workspace.html` retains one projected diagnostic for the latest explicit
sign-in/read attempt. It identifies the operation, last attempted stage (sign-in,
workspace-check or data-read), outcome, known failure category/code, valid HTTP status
and optional UUID correlation reference. Failure panels open automatically; completed
panels remain collapsed. The text can be selected/copied manually for support. There
is no send, upload, clipboard-write, file export, telemetry, event log or persistence.

Recovery guidance distinguishes account credentials, rate limiting, access/scope,
startup/deployment, backend hosting and unavailable purchasing capabilities. It never
recommends enabling posting or silently installing database objects. No retry is sent.
A successful sign-in followed by failed startup is distinguished from rejected auth.
HTTP 200 with malformed data is a failed frontend read, not successful business data.
Completion means the selected operation passed its frontend checks; it cannot certify
all views/roles/companies, tenant isolation or production readiness.

No email/password/key/token, request URL/header/body, company/store/user ID or name,
query/search term, business record/count/value, raw error message, or successful API
payload is retained in the diagnostic. Record results remain subject to the existing
separate memory-only read lifecycle. Sign-out, expiry, pagehide, store/view changes,
clear-search and Clear displayed records also clear the diagnostic. A new attempt
replaces the old summary; late responses/completions cannot overwrite a newer attempt
or repopulate a cleared summary. Reload has no saved diagnostic to restore.

The summary is not a database/server audit trail. It is not proof that an upstream
service did not perform its own auth audit/session activity. Existing read-only/no-write
boundaries are unchanged.

## Error projection hardening

The read adapter and visible error UI previously accepted arbitrary machine-code and
correlation text matching a broad character regex. Allowed characters do not prove
that a string contains no private information. The new shared projection accepts only
reviewed machine codes, integer HTTP status 100–599 and UUID-shaped references.
Authentication descriptions/provider codes also use known allowlists; unknown values
are omitted or mapped to the generic auth-response error. Raw exception text is never
used. Opaque UUID references can be shared deliberately with the backend owner to
locate their server log; business identity is not used to construct a reference.

Server proxy behavior and eight GET-only API functions are unchanged. The diagnostic
wrapper forwards each existing call once and leaves model authorization, expiry,
identity-generation and decode checks authoritative. A private response is not parsed
or copied by the wrapper; it records only projected transport status and fixed stage.
No new dependency, setting or external service was added.

## Verification

123 tests pass. New cases exercise the wrapper with the real read-only workspace and
fake transport: inert state; successful auth/read projection; startup versus auth failure;
HTTP 200 decode failure; raw-code/reference/provider suppression; safe references;
clear/new-attempt/duplicate-completion races; capability/permission/hosting/throttling
recovery advice; and collapsed/open diagnostic rendering without send/retry controls.
Existing plain-Node API, tenancy, session, role, read-contract and no-write tests pass.
TypeScript, production build with environment-file loading disabled and diff checks pass.

A temporary local sample browser preview verified the expanded failure panel, named
copyable diagnostic and manual next-step display with no auth/API transport. The preview
file/tab was removed. This is not signed-in deployment evidence.

No environment file or credential was read, no authenticated live call or Supabase
operation occurred, and no existing OmniPOS or database file was modified.

## Remaining deployment gate

After pushing and Vercel deploys, sign in privately at `/workspace.html` and manually
load a permitted view. Check that the completed diagnostic shows the expected operation.
If a genuine failure occurs, check its stage and safe code/status; do not intentionally
alter records or provoke repeated failures. Clear the records or sign out and verify
the diagnostic disappears. Report only the safe summary if troubleshooting is needed.

That signed-in verification remains open. Backend tenant isolation, bounded/reconciled
finance, SaaS control-plane ownership, recovery delivery, production observability and
pilot evidence still require their own contracts and checks. The roadmap remains partial.
