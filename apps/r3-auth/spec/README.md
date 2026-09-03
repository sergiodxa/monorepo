# r3-auth executable specification

An executable specification of this authorization server, written in the
[`@sdxc/spec`](../../../packages/spec) language. It has two halves that share one
set of building blocks:

- **The URL contract.** One `test` per URL — and per method for every route that
  answers both GET and POST — asserting each endpoint's observable, black-box
  behavior for an _anonymous_ caller: status codes, JSON error envelopes, guard
  redirects, and the accessible controls of the HTML pages.
- **Authenticated behavior.** Specs that sign a real browser in and then assert
  what the app _does_ for a signed-in subject: the profile shows their own data,
  the edit form saves, the session and grant lists render, an admin reaches the
  dashboard and creates a client, an authorization request redirects with a code,
  and signing out returns a protected page to the sign-in screen.

Neither half asserts how the server is built, only what it does.

## Running it

The suite talks to a live dev server on **`http://localhost:3002`**.

1. Bring the local database up once (almost every endpoint touches D1; without
   the schema even the sign-in page 500s):

   ```sh
   cd apps/r3-auth
   bun run db:local:migrate
   ```

2. Start the app (Vite + the Cloudflare Worker on port 3002):

   ```sh
   cd apps/r3-auth
   bun dev
   ```

   The signing keys self-seed in R2 on the first request, so `jwks.json` and
   token signing need no key setup. Visiting the app once also creates the auth
   server's own frozen OAuth client (`Client.ensureAuthServerClient`), which the
   `login` command relies on and which then persists in the local database.

3. Point `DATABASE_URL` at the local Miniflare D1 SQLite file and run the suite
   from the repo root, opting into the config's declared grants. The file is the
   one `*.sqlite` under `.wrangler/state/**/miniflare-D1DatabaseObject/` that is
   not `metadata.sqlite`; its name is a stable hash of the D1 binding id:

   ```sh
   DBFILE="$PWD/apps/r3-auth/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/0094cebb889c9019679bc263eb3cf60e33b6588c609a187d5c7df4ce156cf2f9.sqlite"
   DATABASE_URL="sqlite://$DBFILE" ./packages/spec/bin/spec run apps/r3-auth/spec --allow-config
   ```

   Or from source (slower start): `DATABASE_URL="sqlite://$DBFILE" bun
packages/spec/src/cli.ts run apps/r3-auth/spec --allow-config`.

`--allow-config` applies the two grants `config.jsonc` declares: `net` scoped to
`localhost:3002` (the `http`/`browser` origin) and `env` scoped to
`DATABASE_URL` (the one variable the `db` seeds read). Nothing is granted without
it, so a cloned repo can never self-authorize. The `db` capability opens the
connection string in `DATABASE_URL` — the WAL-mode SQLite file above — which Bun
can write while `wrangler dev` holds it open.

### Structural validity (no live app needed)

Running with **no** grant proves the whole suite parses, loads, and resolves
every name — every test fails closed at the permission gate rather than at a
parse or resolution error:

```sh
bun packages/spec/src/cli.ts run apps/r3-auth/spec
# → "Permission denied: net (57 tests)", exit code 1
```

Exit code 1 (a clean permission denial) confirms structural validity; exit code
2 would signal a parse/load error.

## Signing in, and what gets seeded

The authenticated specs establish their session in `given` through the server's
own surface — there is no back door and no password is written by hand:

- **`login(email, password)`** (`commands/login.spec`) drives the real credential
  form. It opens a `prompt=create` authorization request naming the auth server's
  own client (the only request that renders the credential fields), fills display
  name, username, email and password, and submits. The server treats an unknown
  email as a **registration** — it stores the password as a _verified_ credential
  and issues a code in the same POST — and a known email as a normal sign-in, so
  the same call lands authenticated whether or not the account exists yet. That is
  what makes the fixed accounts (`spec-user@spec.test`, `spec-admin@spec.test`)
  idempotent: the first run registers them, every run after signs them in.

Two things the app's surface cannot grant a fresh account are seeded with SQL
through the `db` capability (`commands/seed.spec`), both idempotent:

- **`seed_admin()`** flips `spec-admin@spec.test` to the `admin` role. In-app
  registration only ever grants `user`, and `requireSubject` re-reads the row on
  every request, so an already-signed-in browser becomes an admin on its next
  navigation.
- **`seed_code_client()`** registers a relying party with a fixed client id whose
  redirect URI is this origin's `/healthcheck`, so a signed-in `/authorize` can
  complete an SSO redirect that lands on a real 200 page.

## Rate limiting (why a full run wants a rested budget)

The server rate-limits its auth surface **per client IP**: the authorization
endpoint at 30 requests/minute and the login POST at 10/minute
(`app/services/rate-limiters.ts`, `wrangler.jsonc`). Every guard redirect and
every sign-in spends from those budgets, and the whole suite runs from one
address, so a back-to-back sequence of runs can carry drained budget from the
previous run into the next and make endpoints answer `429` instead of their
specified status.

For a clean pass, **run against a freshly-started (or ~60s-idle) server** so the
per-IP window has reset; the run itself then fits inside the budget. This is the
app's real protection, not a spec defect — the negative `oauth`/`authorize`
specs assert the `429` shape on purpose. Do **not** run the authenticated specs
with `--concurrency>1`: they share one backend and one IP budget.

## The hardcoded base URL (a known v1 limitation)

Every URL in every spec is the literal absolute string
`http://localhost:3002/…`. This is not a style choice: the v1 `.spec` language
has **no environments mechanism** to bind a base URL against, and the `http`
capability requires an absolute URL for exactly that reason. Pointing the suite
at staging or production today means editing the literals. This is the
environments gap tracked in
`docs/adr/spec/ADR-008-environments-and-compatibility.md`; when a base-URL
binding lands, the host becomes one declaration instead of a per-call literal.

## What the runtime can and cannot observe

A few constraints of the v1 runtime shaped what each spec asserts:

- **Redirects are followed, never observed.** `http` transparently follows up to
  ten redirect hops and returns the final response, so a guard's `303 →
/authorize` surfaces as the sign-in page (a final `200`), not as a `3xx`. No
  spec asserts a `3xx` status or a `Location` header. `browser.url` observes the
  current URL but the runtime cannot _bind_ that observation into a value, so a
  redirect carrying a random value (an authorization `code`) is asserted by the
  page it lands on, not read out of its URL.
- **Request headers, bearer and Basic credentials are available.** `http` can
  attach a `headers { … }` block, a `bearer <token>`, or `basic <user> <pass>`
  (`docs/adr/spec/ADR-015` and `ADR-016`). So the bearer/Basic authenticated
  _success_ paths are specified directly — `GET /api/subjects/:id` with a
  client-credentials bearer, `POST /oauth/{token,introspect,revoke}` with a form
  body and `basic` client auth. The signed-in HTML paths still go through
  `browser`, which carries the session cookie across navigations.
- **Urlencoded and JSON bodies are available; multipart is not.** `http` sends a
  `form { … }` (application/x-www-form-urlencoded), `json`, or `text` body, which
  is what makes the OAuth machine endpoints' happy paths reachable. A bodyless
  `http.post` still reaches a controller with an empty `FormData`, which is how
  the validation-failure envelopes are asserted. Multipart form-data and genuine
  browser form submissions still go through `browser`.
- **Signed tokens are verifiable.** `jwt.verify <token> <jwks_url>` fetches the
  server's JWKS and checks an ES256 signature, returning the payload only when it
  is genuine; `jwt.decode` reads a token's header and claims without verifying.
  The id_token from a token exchange is proven issuer-signed end to end.
- **Scalars and array-presence only.** The language has no array literal and no
  index path segment, so array-valued JSON (`scopes_supported`, `keys`, …) is
  asserted for presence only, and hyphenated header/field names
  (`content-type`, `www-authenticate`) cannot be referenced. Specs assert
  `status`, `ok`, short exact `text`, and scalar `json.<field>` equality.

`http` drives the JSON/OAuth/discovery/health endpoints and every auth-failure
envelope; `browser` (accessibility-first) drives the HTML — the sign-in page, the
signed-in account and admin pages, the logout, the password-recovery forms, and
every guarded page (which redirects an anonymous visitor onto the sign-in page).
`browser` is backed by the globally-installed `agent-browser` CLI, needed only
when a `browser.*` test actually runs; `db` is needed only for the two seeds.

## The OAuth 2.0 / OIDC flows, and the one gap that remains

The machine endpoints are specified on both sides — the credentialed success
_and_ the documented failure — using the `http` `form`/`bearer`/`basic` options
and the `jwt` tools:

- **Token issuance.** `POST /oauth/token` issues a `client_credentials` access
  token (`basic` client auth) and, through the `refresh_token` grant (which needs
  no client credentials), a full token set including a signed `id_token`.
- **id_token verification.** `jwt.verify` checks that `id_token` against the live
  JWKS and its `iss`/`aud`/`sub` claims are asserted — proof it is genuinely
  issuer-signed, not merely well-formed (`id-token.spec`).
- **Introspection and revocation.** `POST /oauth/introspect` reports a live token
  active and an unknown token inactive; `POST /oauth/revoke` invalidates a refresh
  token, which then introspects inactive (`oauth.spec`).
- **Machine API.** `GET /api/subjects/:id` returns a subject for a
  client-credentials bearer, and `404` for a missing one (`api.spec`).

Two success paths remain out of reach, both for the same root cause:

- **A browser-obtained authorization code cannot be exchanged.** The
  `authorization_code` grant itself is expressible (`http.post … form {…} basic
…`), but lifting the fresh `code` out of the `/authorize` redirect would need to
  bind `browser.url` into a value, which the runtime cannot do — and the codes
  live in KV, which the `db` seed cannot populate. The token-endpoint specs use
  the `refresh_token` grant (a seeded session) to reach the same signed token set.
- **`GET /userinfo` claims.** userinfo returns only the claims the access token's
  granted `scope` covers, and the sole grant that stamps a `scope` onto its token
  is `authorization_code` — so the `200` claims body depends on the code exchange
  above. userinfo is specified at its bearer-challenge observable instead, and the
  bearer-carrying success path is proven against `GET /api/subjects/:id`.

## Files

| File                         | Area                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `config.jsonc`               | Scoped `net` (`localhost:3002`) and `env` (`DATABASE_URL`) grants            |
| `commands/login.spec`        | `login(email, password)` — register-or-sign-in through the real form         |
| `commands/seed.spec`         | `seed_admin`, `seed_code_client`, `seed_refresh_session` — the SQL seeds     |
| `commands/sign-in-page.spec` | `assert_on_sign_in_page` — the shared sign-in-page assertion                 |
| `account-signed-in.spec`     | signed-in `/account/*`: landing, profile view/edit, sessions, grants, logout |
| `admin-signed-in.spec`       | admin `/admin/*`: dashboard, subject list, create a client                   |
| `authorize-code.spec`        | signed-in `/authorize` → redirect carrying a `code`                          |
| `id-token.spec`              | `refresh_token` grant → `jwt.verify`/`jwt.decode` the signed `id_token`      |
| `home.spec`                  | `GET /`                                                                      |
| `health.spec`                | `GET /healthcheck`                                                           |
| `discovery.spec`             | both `.well-known` documents + `jwks.json`                                   |
| `userinfo.spec`              | `GET /userinfo` — bearer challenge for a missing and a forged token          |
| `authorize.spec`             | `form /authorize` (anonymous observables)                                    |
| `verify-email.spec`          | `form /verify-email`                                                         |
| `password.spec`              | `form /password/forgot` + `form /password/reset`                             |
| `auth-providers.spec`        | `POST /auth/:provider`, both callbacks                                       |
| `oauth.spec`                 | `POST /oauth/{token,revoke,introspect}` — credentialed success and failure   |
| `oidc.spec`                  | `form /oidc/logout` + `GET /oidc/check-session`                              |
| `account.spec`               | every `/account/*` route (anonymous guard observable)                        |
| `admin.spec`                 | every `/admin/*` route (anonymous guard observable)                          |
| `api.spec`                   | `GET /api/subjects/:subjectId` — client-credentials bearer success, 404, 401 |
