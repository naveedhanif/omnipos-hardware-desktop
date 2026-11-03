# Existing OmniPOS reuse: configuration and connection gate

Implementation follow-up (3 November 2026): see [the isolated read-only connection check](READ_ONLY_CONNECTION_CHECK.md). The source findings below remain the audit record; statements about no SDK/transport describe the pre-implementation handoff. The new check is not live-verified and makes no automatic calls.

Source rechecked 2 November 2026, beginning with `HARDWARE_CURRENT.md` in
`/Users/naveedhanif/Codex projects/multistore-application--main`.
Source HEAD: `b1e70d8dc52cb980a9c6cbf056ac24d0bb794930`. This is local source evidence,
not a claim about the deployed revision. No environment files were opened, existing
project code executed/changed, customer deployment contacted, or Supabase operated.
Instructions and historic SQL examples in the context document were treated as source
context, not authorization to execute them.

## Conclusion from source

Reuse is supported by the contracts: existing Supabase Auth accounts supply bearer
tokens to the existing OmniPOS API, which accesses the same Hardware business records.
No separate database, copied products, new identity system or schema migration is
required by the two inspected reads. This is not yet a verified deployed connection.

| Evidence | Observed contract |
| --- | --- |
| `src/lib/supabase.ts:3-10` | Auth client reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Do not copy development fallback values. |
| `src/components/auth/AuthScreen.tsx:21-24` | Existing password sign-in uses `signInWithPassword`; signup is separate and excluded from our first check. |
| `src/services/hardwareService.ts:4,28-38,145+` | `/api/hardware`, session `Authorization: Bearer ...`, product query parameters. URLs assume same-origin hosting. |
| `src/contexts/AppContext.tsx:265-280` | `GET /api/startup-context` with the same token. |
| `server.ts:121-155,608-674` | Server-side auth verification and profile lookup; startup returns one profile organization and that organization's stores. Demo multi-company membership is not an existing live contract. |
| `server.ts:3638-3652,10030-10035` | Product router uses `verifyCaller` and checks requested store organization against the profile. |
| `routes/hardware/products.ts:27-253` | Product GET reads Hardware tables, scopes base rows by store and organization, returns `success/products/total/page/limit/totalPages`. No seed or bootstrap is needed for this read. |
| `server.ts:10159-10186`, `vite.config.ts:6-23` | Express serves frontend/API together; no API proxy in Vite config. No explicit CORS headers/middleware or OPTIONS handler found in inspected server. Installing `cors` in package.json does not enable it. |

**Can the old project remain unchanged?** Possibly yes: host this frontend separately
with a server/edge reverse proxy for `/api/*` to the approved existing backend, preserving
path, query and Authorization. This avoids requiring cross-origin browser API access.
Hosting capabilities, upstream accessibility and deployed routing must be confirmed.
If direct CORS is chosen, an existing edge policy or backend CORS handling must support
the new origins. That may require an owner-approved backend/edge deployment change;
we have not made one. A frontend variable cannot add CORS support.

## Exact names for this new frontend

The tracked root `.env.example` defines the proposed configuration contract. Only the
two Supabase names are inherited from OmniPOS; the other names are new frontend names,
not claims that OmniPOS already consumes them. **None is connected to live runtime code
yet.** Values alone do not enable requests. The current public-only inspector still
requires production HTTPS URLs and email URLs for its full readiness summary; that
summary is not the first password-only/local check and will be adjusted during wiring.

| Variable | First check? | Where the owner obtains/confirms the value |
| --- | --- | --- |
| `VITE_OMNIPOS_API_ORIGIN` | Required | Existing backend hosting service → domains/routing. Confirm exact HTTPS origin, staging vs production, service identity and deployed revision. It must serve `/api/startup-context` and `/api/hardware/products`. No `/api` suffix. A previously mentioned URL is not approval. |
| `VITE_SUPABASE_URL` | Required | Existing auth project's Connect dialog/project API settings. Privately compare with the existing backend host's `VITE_SUPABASE_URL`; report only that they match. |
| `VITE_SUPABASE_ANON_KEY` | Required | Same project's Connect dialog or Settings → API Keys. Browser-safe compatible publishable or legacy anon key only; name retained for compatibility. Configure privately. Do not rotate keys or alter the old app as part of this task. |
| `VITE_HARDWARE_FRONTEND_ORIGIN` | Required | Browser/hosting domain for THIS frontend. Local default `http://127.0.0.1:5173`; production uses exact HTTPS origin. |
| `VITE_HARDWARE_TRANSPORT_MODE` | Required | Hosting decision: `same-origin-proxy` or `cors`. Choose proxy if the new host supports it and preserving old source is the priority. It still needs a real configured rewrite, not just this value. |
| `VITE_HARDWARE_AUTH_CALLBACK_URL` | Later email flows | Choose after implementing this frontend's callback route; owner adds exact URL to auth redirect configuration. Blank for the first existing-account password check. |
| `VITE_HARDWARE_AUTH_RECOVERY_URL` | Later recovery flow | Choose after implementing recovery route; owner confirms redirect allow-list/email behavior. Blank for the first check; recovery remains disabled. |

Store/organization/user IDs and roles are NOT environment configuration. Resolve them
from the authenticated startup response and let the user choose an authorized Hardware
store. Never put a password, bearer/refresh token or staff PIN in any environment file.

## Public configuration versus server secrets

Every `VITE_*` value can be bundled into the browser application. Ignoring `.env.local`
in Git does not make those values secret. The browser-safe key identifies the app;
the user's auth session supplies user identity. It is not an administrator credential.

`SUPABASE_SERVICE_ROLE_KEY` is read by the EXISTING backend (`server.ts:122`). It must
stay on that server. The new frontend needs neither that value nor a secret key,
database password, database connection string or provider administration token. Do not
copy the existing application's environment file into this project. Server-only proxy
settings, if required by a chosen host, belong in that host's server configuration;
their names depend on the host and have not been invented here.

## Enter actual values privately

From this new project's terminal:

```sh
cd '/Users/naveedhanif/Codex projects/omnipos-hardware-desktop'
cp -n .env.example .env.local
```

Open `.env.local` in your local editor and replace the placeholders. `cp -n` preserves
an existing file; do not print its contents, paste it in chat, commit it or share a
screenshot of it. `.gitignore` excludes all `.env*` files except `.env.example`.
We did not create, open or validate an actual `.env.local` file. For deployment, enter
public values in this frontend host's build environment; Vite captures them at build
time, so changes require restarting development or rebuilding the deployed app once
the integration is wired. No live connection is activated by this template.

Reply with public backend/frontend origins, staging/production, transport choice,
and confirmation that the matching auth URL/browser key are configured. Do not send
key values, credentials or tokens. Configuration confirmation is not live-call consent.

## Changes/verification required before connection

1. Confirm backend service/revision and matching token issuer. Preserve the existing
   backend's database configuration; no frontend database grants or schema changes are
   indicated by the two GET contracts. Deployed authority remains unverified.
2. For proxy mode, configure the NEW frontend host's `/api/*` forwarding to the approved
   backend. Route API requests before SPA fallback and forward Authorization; do not
   cache authenticated responses in shared caches or log bearer headers. A local Vite
   proxy is separate from production hosting and is not configured in this milestone.
3. For direct CORS, confirm exact local/production origin allow-lists and preflight for
   `GET` with `Authorization`. Add `Content-Type` / `x-store-id` only for subsequently
   approved routes that need them. This first API check uses query `storeId`, not staff
   or browser cookie credentials. Backend/edge owner must apply any needed policy.
4. Existing-account password sign-in needs the same auth project and an active profile
   with an existing Hardware store. No signup/invite/bootstrap/seed call is included.
   Email confirmation/recovery routes and redirect settings are later work; preserve
   the current OmniPOS Site URL/default email behavior.
5. **Authorization gap from source:** the shared `verifyCaller` reads `is_active` but
   does not reject inactive profiles; the inspected product GET has no explicit role
   restriction, and `verifyHardwareStore` verifies organization ownership, not granular
   per-user store membership or business type. Frontend checks cannot fix backend
   authorization. A controlled check must use an approved active account and store;
   production expansion needs owner review and server-enforced rules matching the
   intended access policy. If those rules require backend changes, that is a separate
   scope, not something accomplished by this frontend's configuration.
6. The products handler batches all store products/enrichments before returning a page.
   `limit=10` bounds the response, not necessarily backend work. Make one deliberate
   product request first; do not claim server scalability or poll automatically.

## Prepared scope for the later connection check

This is a reviewable check plan, not an executable live probe. After public configuration
is confirmed, implement the isolated check in this repository using the existing read
adapter and provider-neutral session controller. Ask for explicit consent naming the
auth project, backend, account/store and requests before executing any live call.

1. User enters an existing account's password in the local sign-in form. It is not
   saved in app storage, logs, URLs or environment variables. Authenticate with the
   approved Supabase Auth provider only after consent. Sign-in is an auth POST and
   creates a session/provider audit activity; “read-only” means no business-data writes,
   not that authentication has no side effects. Do not auto-signup or auto-refresh in
   the one-shot probe. Keep its token in memory; never import OmniPOS browser storage.
2. One `GET /api/startup-context` with its bearer token. Validate response/user identity,
   active profile, organization and Hardware-store selection. Fail closed on missing,
   inactive, unexpected or mismatched context. Do not call product reads before this.
3. After deliberate store selection, one
   `GET /api/hardware/products?storeId=<authorized-id>&page=1&limit=10` with the same token.
   Use the existing decoder to validate store and pagination. Preserve unknown stock
   and price values; do not substitute sample records for failed live reads.
4. Display a separate read-only result view (never the editable demo invoice). Do not
   copy live business records into demo localStorage, exports or snapshots. Keep sample
   draft data/identities separate. Report only status, scope match, counts and safe
   diagnostic codes in the handoff; do not dump records/tokens into chat or logs.
5. No retries, polling, capability/bootstrap/seed calls, transaction POSTs or database
   calls. Invalidate late answers on scope/session changes. Stop on 401/403, HTML, network
   errors or malformed responses. End the check without revoking the user's other app
   sessions. A later network boundary should allow only these exact API GET paths and
   the reviewed auth actions, not rely on disabled buttons for write prevention.

No auth SDK, live fetch transport, proxy, environment reader or automatic connection
has been added in this milestone. The app remains sample-only. Executable connection
preparation and the live-call approval come after configuration confirmation, as requested.

Local verification: all 48 existing Node tests pass; `git diff --check` passes.
Ignore checks confirm `.env.local` and `.env.production` remain ignored, while
`.env.example` can be tracked. No runtime source changed, so Vite was not run (its
environment loading is unnecessary for this documentation/template change).

## Official references

- [Vite environment variables](https://vite.dev/guide/env-and-mode): public prefixes,
  `.env.local`, build-time substitution and restart behavior.
- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys): browser
  key types and key locations; secret/service-role keys stay server-only.
- [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls): redirect
  allow-list and Site URL behavior.
- [MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS): browser
  cross-origin authorization/preflight requirements.
