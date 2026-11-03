# Sign-in diagnosis and remaining connection gate

Follow-up: the owner has since confirmed successful sign-in, store selection and a real product read. The failures below are historical; no specific root cause is asserted. Current work is described in `LIVE_READ_ONLY_WORKSPACE.md`.

3 November 2026. No database/schema, account, password, key or existing OmniPOS changes.
No auth submission, token read or authenticated API call was made by the agent.

## What is confirmed

- The local checkout and Vercel Production are at `0909dc0` before this change.
  The Vercel project UI shows that deployment Ready. That proves deployment only.
- The owner's existing connection tab displays the older product-only consent text
  and “Sign-in could not be verified. Check your account or contact your administrator.”
  It does not show an authorized store or product result. A fresh tab is needed to
  ensure the current deployed screen is being exercised. An already loaded page does
  not update itself just because a deployment finished.
- That particular message is raised by `browserCheckPorts.signIn`, before a usable
  auth session is returned. It differs from the earlier owner-started startup GET
  that failed with 502 after 15.25 seconds. The two failures must not be conflated.
- Existing browser auth-error logs did not supply a safe HTTP/code diagnosis. No
  credential fields, keys, network response bodies or Supabase dashboard were read.
- Correct-looking public variables, SDK initialization or a Ready deployment do not
  establish successful authentication, matching backend issuer or database connectivity.

## Frontend repair prepared locally

Previously all SDK sign-in failures were flattened into one generic error. The new
`AuthCheckError` projects only known auth codes and valid numeric status. It never
includes provider messages, arbitrary codes, email addresses, passwords or tokens.
The API-response error handler remains separate, so an accepted login followed by
failed startup is no longer described as an unverified password.

The screen announces **Authentication accepted. Loading your authorized company and
stores…** only after validating session identity/expiry. It never announces that the
whole application/database is connected at that point. Invalid/expired/malformed
sessions cannot start the workspace read. A visible “Auth diagnostics” badge identifies
this new version once it is deployed.

One password-grant request remains the only permitted auth action. There are still
no retries, persistent sessions, refresh calls, signup, password reset, CAPTCHA/MFA
bypass, global logout or database calls. Clearing the check affects only its own
in-memory state; original OmniPOS sessions are not revoked.

## How to interpret the next owner-driven attempt

| Displayed code/stage | Meaning and owner-controlled next action |
| --- | --- |
| `AUTH_INVALID_CREDENTIALS` | Provider did not accept the credentials in this auth project. Use the same existing account email/password as OmniPOS; confirm the project is the intended one before considering account changes. A staff PIN is not this account password. |
| `AUTH_EMAIL_NOT_CONFIRMED` | Provider explicitly requires email confirmation. Owner reviews the existing confirmation flow; the frontend must not bypass it. |
| `AUTH_RATE_LIMITED` | Wait before another deliberate attempt; do not automate retries. |
| `AUTH_CAPTCHA_REQUIRED` / `AUTH_MFA_REQUIRED` | Supported verification UI needs review. Do not disable provider protections. |
| `AUTH_ACCOUNT_UNAVAILABLE` | Owner reviews account status through existing administration. No new account is created here. |
| `AUTH_REQUEST_REJECTED` | Provider rejected the request without a recognized safe code. Privately confirm the browser-safe key, project and account settings. This is not automatically a bad-password diagnosis. |
| `AUTH_TIMEOUT` / `AUTH_NETWORK_UNCONFIRMED` | The request did not complete; connectivity/browser policy/provider availability need investigation. No automatic retry or invented credential failure. |
| `AUTH_PROVIDER_UNAVAILABLE` | Provider returned a server-side failure. Owner reviews provider status, without exposing keys or modifying the database. |
| Authentication accepted, then `UPSTREAM_*`/HTTP error | Provider sign-in succeeded; diagnose the existing backend request, target/issuer, permissions, latency or response contract. Do not repeatedly change the account password. |
| Authorized company and store selector | Startup compatibility succeeded. Select an approved store, then explicitly read one selected view. |
| Read-only result | That selected read succeeded; it does not activate the sample workspace or complete all production workflows. |

The owner enters credentials privately in the app. Report only the safe code/status or
success. Never paste an environment file, password, key, token or business records.
The current diagnostic repair has not been pushed/deployed or verified with a real
account. No cause is asserted until the next attempt supplies evidence.

## Verification

All 75 tests and TypeScript checks pass. Four new tests use the actual SDK with fake
responses for rejected credentials, confirmation, rate limit and CAPTCHA codes; they
verify one auth request and zero workspace requests on refusal. They also cover unknown
code/message redaction, a successful response without explicit `expires_at` (SDK computes
it), subsequent backend timeout, and malformed-session rejection before success UI/read.
These results do not prove the owner's credentials, project match or live provider state.

Official contract reference: [Supabase Auth error codes](https://supabase.com/docs/guides/auth/debugging/error-codes).
