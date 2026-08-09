# r3-auth executable specification

An executable specification of every URL this authorization server answers,
written in the [`@pkg/spec`](../../../packages/spec) language. Each `test`
names a URL and method and asserts its observable, black-box behavior — status
codes, JSON error envelopes, guard redirects, and the accessible controls of the
HTML pages — never how the server is built.

The suite is a contract: one `test` per URL, and per method for every route that
answers both GET and POST. 46 tests cover the 46 method+URL combinations of the
33-route surface declared in `routes/web.ts`.

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
   token signing need no key setup.

3. Run the suite from the repo root, opting into the config's declared grant:

   ```sh
   bun packages/spec/src/cli.ts run apps/r3-auth/spec --allow-config
   ```

   Or with the compiled binary (faster start): `./packages/spec/bin/spec run
apps/r3-auth/spec --allow-config`.

`--allow-config` applies the one grant `config.jsonc` declares: `net` scoped to
`localhost:3002`. Nothing is granted without it, so a cloned repo can never
self-authorize.

### Structural validity (no live app needed)

Running with **no** grant proves the whole suite parses, loads, and resolves
every name — every test fails closed at the permission gate rather than at a
parse or resolution error:

```sh
bun packages/spec/src/cli.ts run apps/r3-auth/spec
# → "Permission denied: net (46 tests)", exit code 1
```

Exit code 1 (a clean permission denial) confirms structural validity; exit code
2 would signal a parse/load error.

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
  spec asserts a `3xx` status or a `Location` header.
- **No custom request headers.** `http` sends only a method and an optional
  body, so no `Authorization` or `Cookie` can be attached. Every bearer/Basic
  authenticated _success_ path is therefore out of reach and is specified at its
  auth-failure observable instead (see below).
- **No urlencoded/multipart bodies.** A bodyless `http.post` reaches each POST
  controller with an empty `FormData`, which drives its validation-failure
  branch — the assertable observable. Genuine form submissions (the happy paths)
  go through `browser`, which posts real form encoding.
- **Scalars and array-presence only.** The language has no array literal and no
  index path segment, so array-valued JSON (`scopes_supported`, `keys`, …) is
  asserted for presence only, and hyphenated header/field names
  (`content-type`, `www-authenticate`) cannot be referenced. Specs assert
  `status`, `ok`, short exact `text`, and scalar `json.<field>` equality.

`http` drives the JSON/OAuth/discovery/health endpoints and every auth-failure
envelope; `browser` (accessibility-first) drives the HTML — the sign-in page,
the logout confirmation, the password-recovery forms, and every guarded page
(which redirects an anonymous visitor onto the sign-in page). `browser` is
backed by the globally-installed `agent-browser` CLI, needed only when a
`browser.*` test actually runs.

## Tests that need seeded state

The no-seed failure/guard observables above are all specifiable and asserted.
The corresponding **happy paths** need state this black-box suite cannot create
in dev; each such test carries a `# seeded happy path:` comment describing what a
seeded run would add. They fall into three tiers:

- **Self-bootstrappable in-app (no manual DB seed).** The `/account/*` happy
  paths and a successful `POST /authorize` are reachable by registering through
  `/authorize?…&prompt=create` in a browser, which lands a signed-in session
  without touching the database. Not automated here (it needs a live app and
  writes real rows), but reachable through the server's own surface.
- **Needs a manual DB seed.** Every `/admin/*` happy path needs a subject with
  role `admin` (in-app registration only ever grants `user`). A real OAuth flow
  and the "Client App" sign-in need a registered relying-party client
  (`client_id`/`client_secret`/`redirect_uri`).
- **Out of reach of this runtime regardless of seed.** The bearer/Basic success
  paths — `GET /userinfo` claims, `GET /api/subjects/:id` `200`, and `POST
/oauth/{token,revoke,introspect}` success — cannot be reached because `http`
  sends no `Authorization` header and no urlencoded body, and `browser` cannot
  attach a bearer token. Specified at their auth-failure observable only.

## Files

| File                  | Area                                                         |
| --------------------- | ------------------------------------------------------------ |
| `config.jsonc`        | Scoped `net` grant for `localhost:3002`                      |
| `commands/`           | `assert_on_sign_in_page` — the shared sign-in-page assertion |
| `home.spec`           | `GET /`                                                      |
| `health.spec`         | `GET /healthcheck`                                           |
| `discovery.spec`      | both `.well-known` documents + `jwks.json`                   |
| `userinfo.spec`       | `GET /userinfo`                                              |
| `authorize.spec`      | `form /authorize`                                            |
| `verify-email.spec`   | `form /verify-email`                                         |
| `password.spec`       | `form /password/forgot` + `form /password/reset`             |
| `auth-providers.spec` | `POST /auth/:provider`, both callbacks                       |
| `oauth.spec`          | `POST /oauth/{token,revoke,introspect}`                      |
| `oidc.spec`           | `form /oidc/logout` + `GET /oidc/check-session`              |
| `account.spec`        | every `/account/*` route (guard observable)                  |
| `admin.spec`          | every `/admin/*` route (guard observable)                    |
| `api.spec`            | `GET /api/subjects/:subjectId`                               |
