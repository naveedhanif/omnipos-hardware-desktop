# Separate frontend connection: verified source and missing public configuration

2 November 2026. No deployment URL is approved by inference. Real sign-in, live API
calls and all live transaction posting remain disabled.

## What local files verify

Read-only source project: `/Users/naveedhanif/Codex projects/multistore-application--main`,
HEAD `b1e70d8dc52cb980a9c6cbf056ac24d0bb794930` at inspection.

- `src/lib/supabase.ts:1-10` calls `createClient(url,key)` and reads
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from environment bindings. It has
  development fallback placeholders, which are not approved production configuration.
  No project URL or actual key value was obtained, copied or disclosed.
- `src/components/auth/AuthScreen.tsx:15-25` uses `signInWithPassword({email,password})`
  and `signUp({email,password})`. No explicit email redirect override is set there.
- `src/services/hardwareService.ts:4,28-38` uses `/api/hardware` and session bearer auth.
  Other request construction uses `window.location.origin`; it does not establish a
  separately configurable public backend origin.
- `src/contexts/AppContext.tsx:265-280` requests relative `/api/startup-context` with
  the same auth session token. The backend verifies that token and loads its profile.
- `server.ts:114-118,10165-10188` serves the built frontend, or Vite middleware, from
  the same Express application as the API. Port 3000 is source behavior, not proof
  of any public hostname or approved externally accessible service.
- `vite.config.ts:6-23` has no API proxy target. It calls `loadEnv` when executed;
  this audit read source text only and did NOT execute it or load environment files.
- No explicit CORS middleware, access-control response headers or OPTIONS handler was
  found in the inspected `server.ts`. An external proxy could configure CORS, but its
  deployed configuration was not inspected. Absence in this file does not prove the
  deployed network rejects or allows an origin.
- No Render/Vercel/Netlify/Docker deployment manifest was found by the targeted
  non-environment-file search. The deployed domain, routing, origin allow-list and
  deployed revision therefore remain unverified. A repository URL is not an API URL.

No `.env` files were read. No credentials were exposed. Existing source was not edited,
and there were no requests to the OmniPOS deployment, Supabase project, database or
management API. Only public documentation was consulted for the requirements below.

## Exact values still needed, and where the owner can find them

| Missing value | Purpose | Where to find/confirm it |
| --- | --- | --- |
| Approved **OmniPOS API origin**, including HTTPS scheme/host/port and any routing constraint | Target for existing `/api/startup-context` and `/api/hardware/...` handlers | Existing backend hosting dashboard → service domain/custom domains and routing settings. Confirm the service is the intended Hardware backend and the deployed revision. Do not infer approval from a previously mentioned deployment link. |
| Matching **Supabase project URL** (existing name `VITE_SUPABASE_URL`) | Same token issuer/project used by the approved OmniPOS backend | Owner opens that project's **Connect** dialog; compare privately with the existing backend deployment's configured project. We did not inspect its values. |
| **Browser-safe client key**, configured privately (existing name `VITE_SUPABASE_ANON_KEY`) | Initialize the approved auth client, not authenticate a user by itself | Project **Connect** dialog or **Settings → API Keys**. Existing source names the legacy anon key. Confirm the intended legacy anon or supported publishable key with the owner; never use secret/service-role keys. Do not paste key values into chat or source. |
| New frontend's **production origin** and intended local-development origin | Host the app; define exact allowed browser origins | New frontend hosting dashboard → domains. Current local preview is `http://127.0.0.1:5173`; localhost is a different origin and must be treated explicitly if used. No frontend production domain was selected in this audit. |
| Approved **auth callback URL** and **password recovery URL**, plus existing Site URL behavior | Support confirmation/recovery returns to the correct application | Owner reviews **Authentication → URL Configuration** and email templates in the correct project. The routes in this new frontend still need implementation; there is no approved callback path yet. Preserve the existing OmniPOS app's defaults unless a deliberate shared-app change is approved. |
| Approved **transport arrangement**: same-origin reverse proxy OR direct CORS | Make separately hosted browser requests reach the intended backend | Owner confirms new frontend hosting rewrites/reverse proxy and/or backend/edge CORS configuration. A Vite dev proxy is not a production proxy. No arrangement has been configured here. |

The browser-safe key identifies the client; the authenticated user's bearer token still
identifies the account. There must be no service-role/secret credential in this frontend.
The owner should configure the key privately in the deployment; only its type and
configuration status need to be reported here.

## Requirements for a separately hosted frontend

1. Reuse the same approved auth project and account identities. Do not introduce a
   parallel user database or invent a custom `/api/login` endpoint.
2. For a same-origin proxy, route the new frontend's `/api/*` requests to the approved
   backend and forward required headers. Confirm actual host routing before enabling it.
3. For direct cross-origin API requests, the backend/edge must respond correctly to
   preflight and allow the exact approved frontend origins, read methods and headers.
   `Authorization` triggers preflight. Existing routes also use `Content-Type` and, for
   some functions, `x-store-id`; allow only headers/methods needed for the enabled scope.
   Reads are the first integration scope; live writes remain disabled.
4. The proxy/CORS policy is not tenant authorization. Backend active profile, organization,
   store, role and operator checks identified in Phase 2 must remain authoritative.
5. Configure callback/recovery routes and exact allow-list entries before enabling the
   corresponding email flow. Existing signup code relies on provider default redirect
   behavior, so copying it unchanged could return users to the existing application.
6. Client auth sessions for a separately hosted app must be initialized and reconciled
   through the provider. Do not transfer access tokens in query strings or import the
   existing application's browser storage as a credential source.
7. Confirm the actual target, provider values and deployment arrangement before adding
   a real transport or auth provider. Local public-config checks cannot approve a target.

## Preparation in this new repository

`src/integration/publicConnection.ts` validates a caller-supplied public configuration
candidate without reading environment files, fetching URLs or taking a key value.
Even a fully populated candidate cannot enable sign-in, API calls or posting. No real
transport or auth SDK has been added. Settings → Connection setup displays the missing
configuration checklist while the app continues to use tenant-scoped local sample data.

## Public documentation consulted

- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys): browser
  key types and the Connect / Settings → API Keys locations. No signed-in dashboard used.
- [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls): Site URL,
  redirect allow-list and confirmation/recovery behavior.
- [MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS): preflight
  behavior and server-side requirements for cross-origin Authorization headers.
