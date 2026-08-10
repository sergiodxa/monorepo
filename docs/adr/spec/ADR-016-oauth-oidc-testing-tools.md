# ADR-016: OAuth2 / OIDC Testing Tools — `url`, `jwt`, and HTTP `bearer`/`basic`

## Status

**Proposed** - 2026-08-09

This ADR records the capabilities added so a `.spec` suite can specify an
OAuth 2 / OpenID Connect server end to end: a `url` capability for parsing
redirect URLs, a `jwt` capability for reading and cryptographically verifying
tokens, and two HTTP auth shortcuts (`bearer`, `basic`). Like
[ADR-009](./ADR-009-v1-typescript-implementation.md) through
[ADR-015](./ADR-015-http-request-options.md), it is an implementation ADR: not
standalone, free to reference this monorepo's packages and conventions, and
bound by the design suite
([ADR-001](./ADR-001-executable-specification-language.md) through
[ADR-008](./ADR-008-environments-and-compatibility.md)) rather than amending it.
Its parents are [ADR-009](./ADR-009-v1-typescript-implementation.md) (the v1
implementation, whose §C5 specified the `http` plugin) and
[ADR-015](./ADR-015-http-request-options.md) (HTTP request options), which it
builds directly on. The choice recorded here is **v1-provisional**: binding on
this implementation, invisible to the design record, cheap to revisit.

## Context

[ADR-015](./ADR-015-http-request-options.md) gave the `http` plugin request
headers and form/text/json bodies, which made the individual OAuth requests
expressible. But it closed with an explicit gap: the end-to-end
`authorization_code` chain still could not be written, because a spec had no way
to (a) extract the `?code=` a redirect URL carries and (b) prove the returned
`id_token` is genuinely issuer-signed rather than merely a well-formed string.
Both are capability gaps, not language gaps — and ADR-015 (Open Questions)
speculated they might need string interpolation. They do not.

A read-only scout of the `r3-auth` OIDC server (`apps/r3-auth`) fixed the
concrete facts the tools must match:

- **Signing algorithm is ES256 only** (ECDSA P-256 / SHA-256):
  `id_token_signing_alg_values_supported: ["ES256"]`
  (`app/config.ts`), signed by `app/services/signing-keys.ts`. It is the only
  algorithm advertised and the only one relying parties accept.
- **The token `iss` claim is scheme-less** `auth.sergiodxa.com` (frozen), which
  differs from the `https://auth.sergiodxa.com` used as the authorize-redirect
  `iss` parameter. A verifier must therefore **not** infer the issuer from the
  JWKS URL's origin.
- **The JWKS** at `/.well-known/jwks.json` publishes
  `{ keys: [{ crv:"P-256", kty:"EC", x, y, kid }] }` — it carries a `kid` but no
  `alg` and no `use`. Tokens carry `{ alg:"ES256", kid }` in their protected
  header.
- **Client authentication** is `client_secret_basic` **and**
  `client_secret_post` at the token endpoint, but **`client_secret_basic` only**
  at introspection and revocation (`credentialsFromHeader`).
- **PKCE is not required** for the confidential client under test. The
  authorization-code grant checks the verifier only when the authorize request
  carried a `code_challenge`; the confidential (secret-bearing) client
  authorizes without one, so the code redeems on `client_secret` +
  `redirect_uri` alone.

The design constraint is unchanged from the whole `.spec` project: new
capability is delivered as **tools (plugins), never grammar**. The language stays
declarative — no string concatenation, interpolation, control flow, or operators
([ADR-002](./ADR-002-specification-language-design.md)). Composition lives inside
tool calls and `let` bindings.

## Decision

Add three capabilities. None changes the grammar, the token set, or the
evaluation rules; each is an argument-shape decision inside a plugin.

### 1. The `url` capability (new plugin, permissionless)

Namespace `url`, every tool `observable` and requiring **no** permission — it is
pure string parsing over a URL the spec already holds, touching no I/O.

- `url.query <url> <name>` → the value of query-string parameter `name`.
- `url.fragment <url> <name>` → the value of parameter `name` after the `#`
  (`new URLSearchParams(url.hash.slice(1))`), the implicit/hybrid response shape.
- `url.path <url>` → the pathname; `url.host <url>` → the host and port.

A non-string argument, an unparseable URL, or (for `query`/`fragment`) a missing
parameter is a `ToolError` naming the parameter and the URL. `query`/`fragment`
**never** bind a silent null — an absent parameter fails loud, so a spec cannot
proceed on a redirect that reported an `error` instead of a `code`.

This is what closes ADR-015's code-extraction gap **without** string operators:
a flow binds the redirect URL and reads the code from it as a normal tool call
(`let code = url.query landing "code"`), not as string surgery.

### 2. The `jwt` capability (new plugin)

Namespace `jwt`, two tools:

- `jwt.decode <token>` → `{ header, payload }`, base64url-decoding both segments
  to JSON objects with **no** signature check. `observable`, **permissionless** —
  it is a pure read for asserting on claims (`decoded.payload.sub`,
  `decoded.header.alg`). A token without three segments, or a segment that is not
  base64url of a JSON object, is a `ToolError`.
- `jwt.verify <token> <jwks_url>` → the verified **payload**. `action`,
  **`requires: "net"`** (it reaches the network to read the JWKS, consistent with
  the `http` verbs). The steps, in order: decode the header and require
  `alg === "ES256"` (rejecting every other algorithm **before** any I/O, which
  closes alg-downgrade); parse the JWKS URL and pass `checkNet(host, port)`;
  fetch the JWKS; select the key by `kid` (a named-but-absent `kid` is a hard
  error — no silent fallback to another key; when the header omits a `kid`, the
  sole key or the single EC/P-256 key is used); import it with
  `crypto.subtle.importKey("jwk", {kty,crv,x,y}, {name:"ECDSA",
namedCurve:"P-256"}, false, ["verify"])`; verify the raw r‖s signature over
  `header.payload` with `crypto.subtle.verify`; then reject an expired (`exp`) or
  not-yet-valid (`nbf`) token. Any failure is a `ToolError`; only success returns
  the payload.

`jwt.verify` deliberately does **not** enforce `iss` or `aud` — it returns the
payload and the author asserts those with `expect`. This is what lets a spec
verify a token whose scheme-less `auth.sergiodxa.com` issuer differs from the
`localhost` JWKS origin: the tool proves the signature; the spec judges the
claims.

**No JWT library, no new dependency.** Bun's WebCrypto verifies ES256 natively:
importing a public JWK needs only `{kty,crv,x,y}`, and JWS carries the exact
64-byte raw signature `crypto.subtle.verify` consumes. A `jose`-style dependency
was considered and rejected as unjustified weight for one algorithm.

### 3. HTTP `bearer` / `basic` (extend the `http` plugin)

Two new word-tagged options on every `http` verb, alongside ADR-015's
`headers`/`form`/`json`/`text`. They add **no** permission surface — the values
are author-provided, and reaching the host is already gated by `net`.

- `bearer <token>` — consumes one string, sets `Authorization: Bearer <token>`.
- `basic <user> <pass>` — consumes **two** strings, sets
  `Authorization: Basic <base64(user:pass)>` (RFC 7617). It is the first option
  word that consumes two arguments; a non-Latin-1 credential (which `btoa`
  refuses) is a `ToolError`, not an unhandled throw.

Precedence in the built init is fixed by layering: the body's default
content-type goes down first, then the `Authorization` from `bearer`/`basic`,
then the author's `headers` last — so an explicit `headers.authorization`
**overrides** the shortcut. A call carries at most one auth option; `bearer` with
`basic`, a repeat, or a tag missing its value(s) is a `ToolError`. These parse as
plain words ([ADR-002](./ADR-002-specification-language-design.md)); no parser
change was needed.

### PKCE / `crypto` deliberately deferred

The plan floated a `crypto`/`encoding` tool (`base64url`, `sha256`) for PKCE
(`code_challenge = base64url(sha256(verifier))`). The scout confirmed the
confidential-client flow under test does **not** use PKCE, so building it now
would add an abstraction with no caller — violating "no second similar
abstraction / do not over-build." It is recorded as a fast-follow: public-client
/ mobile PKCE testing would need `crypto.base64url` + `crypto.sha256` with a
**fixed literal** `code_verifier` (never random) for deterministic specs.

## Consequences

- The full `authorization_code` chain is now expressible with tools only:
  `browser` authorize → bind the landing URL → `url.query … "code"` →
  `http.post … form { … }` (or `basic`) → `jwt.verify … jwks_url` → assert
  `iss`/`aud`/`sub` → `http.get … bearer <access_token>` →
  `http.post … basic <id> <secret> form { token: … }`. Introspection and
  revocation, which are `client_secret_basic`-only, are reachable via `basic`.
- ADR-015's stated gating gap (extracting `?code=` and composing a bearer header)
  is closed **without** string interpolation — the language did not grow. This
  is the concrete evidence for the tools-not-grammar rule: a capability that
  looked like it needed string operators needed two small tools instead.
- `jwt.verify` gives a **non-trivial** assertion: a tampered token fails the
  signature check, so "the id_token is genuinely issuer-signed" is a real
  property a spec can hold, not a shape check.
- No new permission family. `net` remains the entire network authorization story
  (`jwt.verify` reuses it for the JWKS fetch), and `url`/`jwt.decode` are
  permissionless because they do no I/O — keeping the deny-by-default model
  ([ADR-007](./ADR-007-deny-by-default-permissions.md)) and the operator's mental
  model unchanged.
- ES256-only is a deliberate, security-positive constraint: refusing every other
  `alg` outright (before touching the JWKS) is the correct answer to alg
  confusion, and it matches the one algorithm `r3-auth` signs with.

## Open Questions

These are v1-provisional pressure points, not reopenings of the design suite.

- **A bound scalar reaches a tool only through a reference.** Because a bare
  identifier in tool-argument position is always a symbolic _word_
  ([ADR-002](./ADR-002-specification-language-design.md)), a scalar binding (the
  string `browser.url` returns) is passed to `url.query`/`jwt.verify` either as a
  dotted reference into an object binding, or by boxing it first
  (`let where = { url: landing }` then `url.query where.url "code"`), the same
  pattern the dogfood commands already use for their parameters. The plan's
  shorthand `url.query landing "code"` works only when `landing` is genuinely a
  reference; a bare binding must be boxed. No language change is proposed — this
  is the documented cost of keeping words symbolic.
- **PKCE / `crypto`.** Deferred as above; needed only for public-client flows.
- **Algorithms beyond ES256.** RS256/EdDSA verification would be a natural
  extension if another server needs it; deliberately omitted while the only
  target signs ES256.
- **`iss`/`aud` enforcement inside `jwt.verify`.** Left to `expect` on the
  returned payload, because the issuer is scheme-less and the audience is
  per-client — folding them into the tool would hard-code one server's policy.
- **Multi-key JWKS with no `kid`.** When a header omits `kid` and several EC keys
  are published, the first is used; unambiguous in practice because `r3-auth`
  always carries a `kid`. A stricter "ambiguous, refuse" could replace it if a
  real suite hits it.
