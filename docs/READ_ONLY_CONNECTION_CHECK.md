# Existing OmniPOS read-only connection check

## Current deployment gate — 3 November 2026

The owner deployed commit `52ef465`. The production connection page loads and passes
its configuration gate. An unauthenticated GET to its `/api/startup-context` function
returned Vercel `500 FUNCTION_INVOCATION_FAILED`; runtime logs for deployment
`HQ86ELcjS2m6U18vijdMb8PusdCn` show `ERR_MODULE_NOT_FOUND` for
`/var/task/server/readOnlyProxy` imported by `/var/task/api/startup-context.js`.
The owner independently reported the same error. No token was sent by the agent and
the function failed at module loading, before the handler could contact the backend.

The local repair gives both API imports an explicit `.ts` extension and sets
`rewriteRelativeImportExtensions: true`. TypeScript emits relative `.js` imports for
Node, including transitive imports. No request allow-list, auth behavior, backend
target or database setting changed. The repair has not yet been deployed or checked
on Vercel.

`tests/function-runtime.test.ts` emits the real function dependency graph as separate
JavaScript files and starts both handlers in a child Node process with no TS loader
or bundler. It reproduced the original missing-module error before the fix and passes
after it. It checks missing-session GET → 401, all four write methods → 405, no-store
headers and zero fetch calls. The earlier bundle-only check did not catch this error.
All 59 tests, TypeScript and the environment-free frontend build pass locally.

After deploying the repair, first check `/api/startup-context` WITHOUT credentials:
it must return JSON with `SESSION_REQUIRED` (401), not a Vercel 500/HTML page. This
request must not reach the existing backend. Then the owner can retry existing-account
sign-in and the product read. Agent-run authenticated calls still need the specific
account/store approval described below. Do not mark connectivity verified until that
signed-in sequence succeeds. Subsequent stock/customer/supplier integration remains
behind this gate; inventory source inspection alone is not a live result.

References: [Node ESM extensions](https://nodejs.org/api/esm.html#mandatory-file-extensions),
[TypeScript extension rewriting](https://www.typescriptlang.org/tsconfig/rewriteRelativeImportExtensions.html),
[Vercel TypeScript compiler implementation](https://github.com/vercel/vercel/blob/main/packages/node/src/typescript.ts).

## Initial implementation record

Prepared 3 November 2026 in the new Hardware repository only. This implementation has
not been pushed, deployed or checked against live authentication/business data by the
agent. The existing OmniPOS project and database are unchanged.

## What is implemented

- `/connection.html` is a separate Vite entry. Settings → Connection setup links to it.
  Opening the screen makes no auth or business API request. The editable application
  continues to use sample services and scoped demo browser data.
- Public Vercel build variables are checked against the specific origins inspected in
  the owner's Vercel settings: frontend `https://omnipos-hardware-desktop.vercel.app`,
  backend `https://omnipos-hardware-pilot.onrender.com`, auth project
  `https://esjbplouepusbzrrkfvs.supabase.co`. These origins contain no credentials.
  A different custom/preview domain or backend needs a deliberate review/code update.
  A trailing slash on a root origin is accepted. The environment name “Production” in
  Vercel does not establish whether the existing Render pilot uses production records.
- `VITE_SUPABASE_ANON_KEY` is restricted to a browser-safe publishable key or a legacy
  anon JWT referencing that auth project. Secret/service-role values are refused. This
  structural check is not cryptographic validation of a key or proof it matches the
  deployed backend. Public configuration/key values are never printed by the check.
- After the user explicitly accepts the request scope and submits existing credentials,
  the official Supabase SDK performs one password sign-in. It has no persistent session,
  refresh timer, URL session detection or access to the old app's browser storage.
  A fetch boundary permits only the reviewed auth token POST with password grant.
  Signup, recovery, refresh, direct table/RPC requests and remote logout are unavailable.
- The existing read adapter validates startup identity, active profile and Hardware
  store selection. One product-page read is then permitted, using a store from that
  response. Results are read-only and remain in memory. Ending/navigation/reload clears
  the check; page restoration clears old results. The check's session is discarded
  after the product request even when it fails. Other OmniPOS sessions are not revoked.

## The only permitted network sequence

| User action | Request |
| --- | --- |
| Consent + existing-account sign-in | `POST <approved-auth-origin>/auth/v1/token?grant_type=password` |
| Same sign-in action, after successful auth | `GET /api/startup-context` with bearer token |
| User chooses a returned Hardware store and clicks Read 10 products | `GET /api/hardware/products?storeId=<id>&page=1&limit=10` with bearer token |

No request runs automatically on page load. No automatic retries, polling, bootstrap,
seed, business write or database connection exists. Authentication creates a provider
session/audit activity; “read-only” refers to business records, not zero auth side
effects. A new product check requires a fresh deliberate sign-in.

## Proxy implementation and hosting

This is a method-restricted Vercel Node function proxy, **not an unrestricted rewrite**:

- `api/startup-context.ts` and `api/hardware/products.ts` share
  `server/readOnlyProxy.ts`.
- Only GET and the exact path/query scope above are forwarded. POST/PUT/PATCH/DELETE,
  unknown query keys, duplicate keys, extra pages and unrelated paths are refused.
- The runtime target must match `VITE_OMNIPOS_API_ORIGIN` and the reviewed Render origin.
  Only bearer Authorization and Accept are forwarded. No cookies, client-selected
  destination, client body or database credential is forwarded.
- Upstream redirects are refused; requests time out without retry. HTML, invalid JSON,
  oversized responses and network failures are refused. Error responses are sanitized.
- Every proxy response has private/no-store and CDN no-store headers. This is a
  function response, so external-rewrite caching is not involved. Provider/hosting
  request logs may still exist; the app adds no token/body/record logging.
- `vercel.json` adds a restrictive policy to the connection document: only this site's
  scripts/styles and this site plus the reviewed auth origin for network connections.
  There is no transaction proxy. The existing backend is not modified.

Vercel must build both Vite HTML entries and deploy both `api/` functions. Confirm
function routing and no-store headers after deployment before live sign-in. A static
Vite preview alone does not run these functions. Local Vite can show the configuration
gate, but local live calls require a reviewed function-serving development setup; no
generic local proxy has been silently added.

## Configuration

Keep the five Production values already added in Vercel:

1. `VITE_OMNIPOS_API_ORIGIN` — reviewed Render backend origin.
2. `VITE_SUPABASE_URL` — reviewed existing auth project origin.
3. `VITE_SUPABASE_ANON_KEY` — matching browser-safe client key, privately configured.
4. `VITE_HARDWARE_FRONTEND_ORIGIN` — exact reviewed Vercel frontend origin.
5. `VITE_HARDWARE_TRANSPORT_MODE` — `same-origin-proxy`.

Callback/recovery variables remain unused. No server-only secret is needed by these
functions. Vite captures public frontend values at build time; Vercel function runtime
also needs the API-origin setting. A new deployment is required for code/config changes.
The `.env.example` is only a template; no actual environment file was read or created.

## Verification and remaining gate

- TypeScript checks include frontend, tests, Vercel functions and the shared server code. Both function entries also bundle successfully; a bundled handler rejects POST with no-store headers using a local fake response.
- The production multipage build passed with environment-file loading explicitly disabled
  (`build({envFile:false})`). No real key is required for this build.
- All 58 tests pass. Ten new cases exercise key/target rejection, exact allow-lists,
  response size limits, zero forwarding for writes/invalid input, redirect/HTML/error
  handling, no-store method refusal, consent and one-read limits, inactive/foreign
  identities, expiry, cancellation/late responses, and the actual SDK with fake fetch.
  The SDK test sends one auth request to an in-memory response only.
- The local connection screen was inspected without configuration: it displays missing
  settings and disables sign-in. No live provider/backend connection has been tested.

**Before agent-run live calls:** ask the user to approve this exact auth project/backend,
existing account and selected Hardware store, and the three-request sequence above.
Passwords are entered by the user in the app, never pasted into chat. Do not treat the
presence of environment variables or a successful deployment as that approval.

The backend authorization gaps described in `CONNECTION_CONFIGURATION.md` remain:
the inspected shared helper lacks inactive-profile rejection and product reads lack
granular role/store-membership checks. This UI rejects inactive startup profiles but
cannot establish server authorization. The proxy forwards existing bearer authority;
it does not grant, repair or prove tenant permissions. A controlled check must use an
approved active account/store. Production authorization testing, deployed issuer match,
real CORS/provider behavior and function deployment remain unverified.

## References

- [Supabase password sign-in](https://supabase.com/docs/reference/javascript/auth-signinwithpassword)
- [Supabase initialization](https://supabase.com/docs/reference/javascript/initializing)
- [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js)
