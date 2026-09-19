# ADR-011: Authorization Endpoint and PKCE

## Status

**Proposed** - 2026-09-18

## Background

`/authorize` is where a relying party hands the browser to the tenant and where the tenant
decides whose browser it is. Everything the token endpoint later verifies is fixed here:
which subject, which client, which redirect target, which scopes, which proof key.
[ADR-002](./ADR-002-rebuild-path-and-implementation-order.md) places it after sessions,
signing keys, clients and consent exist, so it composes pieces already built. What is left
to settle is how a request is validated, where each class of failure is reported, what an
authorization code record holds, and how the endpoint behaves when the browser already
carries a session. Its characteristic failures — an open redirect, a code that outlives its
exchange, a code replayed into another client — are decided once, here. The endpoint
belongs to the OIDC/OAuth2 core, so it is available on Free.

## Context

### A redirect target is trustworthy only after it has been verified

An error has two destinations, and the request's own validity decides which.

| Condition                                                                    | Response                                 |
| ---------------------------------------------------------------------------- | ---------------------------------------- |
| `client_id` missing, unknown, or naming a disabled client                     | Render an error on the tenant's hostname |
| `redirect_uri` missing, or not string-equal to one registered for that client | Render an error on the tenant's hostname |
| Everything else — bad `scope`, bad `response_type`, absent `code_challenge`   | 302 to the verified `redirect_uri`       |

OAuth 2.1 requires exactly this: a request failing on a missing, invalid or mismatching
redirect URI is reported to the resource owner, and the user agent is not redirected there.
Matching is simple string comparison over the registered set per RFC 3986 section 6.2.1,
with the one exception OAuth 2.1 mandates — a native app on an `http://127.0.0.1` or
`http://[::1]` loopback address may vary the port.

A redirected error carries `error`, `error_description`, the request's `state`, and `iss` —
optional in OAuth 2.1, always sent here so a client talking to several providers knows
which one answered. The codes served are the OAuth set (`invalid_request`,
`unauthorized_client`, `access_denied`, `unsupported_response_type`, `invalid_scope`,
`server_error`, `temporarily_unavailable`) and the OIDC interaction set.

### PKCE applies to every client

OAuth 2.1 requires rejecting a request without `code_challenge` from a public client, and
from any other client unless the server has reasonable assurance the client mitigates code
injection another way. This design offers no such assurance for any client: a confidential
client's secret protects the back channel, and the code travels the front channel, through
a browser, a redirect, sometimes a custom URI scheme. `code_challenge_method` is required
and must be `S256`; the base specification reads an absent method as `plain`, so requiring
the parameter keeps a downgrade from being the default.

### The request has to survive the round trip through sign-in

`state`, `nonce`, `prompt`, `max_age` and the requested scopes are established before
authentication and consumed after it, and carrying them through the sign-in page as
parameters makes that page a place where one flow's request can be rewritten between its
halves. The validated request is stored in the tenant object under an opaque interaction
id, and the pages carry only that id, so the request that reaches the object once is the
request that completes.

## Decision

`/authorize` serves `response_type=code` with `response_mode=query`, and one RPC call into
the tenant object performs the whole operation.

```ts
beginAuthorization(input: {
  query: Record<string, string>;
  sessionIds: string[];
  now: number;
}): AuthorizationOutcome;

resumeAuthorization(input: {
  interactionId: string;
  sessionId: string;
  now: number;
}): AuthorizationOutcome;

type AuthorizationOutcome =
  | { kind: "redirect"; location: string }
  | { kind: "render"; error: string; description: string }
  | { kind: "authenticate"; interactionId: string; loginHint: string | null; forced: boolean }
  | { kind: "consent"; interactionId: string; screen: ConsentScreen };
```

The Worker passes the raw query map and the session ids the browser presented; the object
parses and validates them with `remix/data-schema`, resolves the client itself, and returns
one plain outcome. `redirect` holds the complete `Location` value, carrying a code or an
error, so building a redirect is never split across the boundary. `resumeAuthorization`
reads the stored request rather than a query string, so a flow's second half asks for no
more than its first.

### When an existing session short-circuits the prompt

| Session                     | `prompt`  | Outcome                          |
| --------------------------- | --------- | -------------------------------- |
| None                        | absent    | `authenticate`                   |
| None                        | `none`    | `redirect` with `login_required` |
| Valid                       | absent    | Consent evaluation, then a code  |
| Valid                       | `login`   | `authenticate` with `forced`     |
| Valid, older than `max_age` | absent    | `authenticate` with `forced`     |
| Valid, older than `max_age` | `none`    | `redirect` with `login_required` |
| Valid                       | `consent` | `consent`                        |

`none` combined with any other value is `invalid_request`, and `max_age=0` is equivalent to
`prompt=login`. `select_account` renders the chooser when the browser carries several
sessions, behaves as `login` when it carries one, and returns `account_selection_required`
under `none`. Whenever `max_age` is present the ID token carries `auth_time`, as OIDC
requires, read from the instant the session ADR records.

### Tables

`authorization_requests` holds a pending interaction: an `id`, the validated parameters,
`created_at`, and an `expires_at` ten minutes out, which is the time a person has to sign in.

`authorization_codes` holds the four bindings the token endpoint checks — `code_hash`,
`client_id`, `redirect_uri`, `code_challenge` — what a token is minted from (`scopes`,
`subject_id`, `session_id`, `nonce`, `auth_time`), and `created_at`, `expires_at`,
`redeemed_at`, `token_family_id`. The code is a `randomToken` from `@sdxc/crypto` and the
row stores its SHA-256, so object storage holds nothing exchangeable. A code lives 60
seconds, inside the ten-minute maximum OAuth 2.1 recommends, because a redirect and a
back-channel POST are a second or two apart.

Redemption is one statement, with no `await` between reading and marking the row, so two
concurrent exchanges cannot both win:

```sql
UPDATE authorization_codes SET redeemed_at = ?, token_family_id = ?
 WHERE code_hash = ? AND redeemed_at IS NULL AND expires_at > ?
 RETURNING *
```

A redeemed row stays readable until the retention sweep ADR-004's schema registry runs for
every bounded table, which is what makes a replay recognizable as one: the second attempt
fails, and `token_family_id` names the tokens to revoke, as RFC 6749 section 10.5 requires
and ADR-012 carries out.

## Consequences

### Positive

- One round trip serves an authorization request, covering client resolution, redirect
  verification, session evaluation and code minting, and the open-redirect class is closed
  by construction: the object builds every `Location` itself from a verified target.
- A leaked code is unusable without the verifier, for confidential clients as well as
  public ones, and a dump of object storage yields no exchangeable credential.

### Negative

- Requiring `S256` from every client refuses clients that would otherwise work, including
  confidential server-side ones that predate PKCE.
- A pending interaction makes the sign-in flow stateful in the object, so an abandoned flow
  leaves a row until its sweep, and a 60-second code fails a client whose clock or network
  makes the exchange slower — a failure that reads as a bad code rather than a slow one.

### Neutral

- `state` is a client-side correlation value: stored with the request, echoed unmodified on
  the success redirect and on every error redirect, and never interpreted.
- `nonce` is optional in the authorization code flow, stored and echoed into the ID token
  when present; PKCE covers replay for the clients that omit it. Only `response_type=code`
  is served, so hybrid and implicit have no behaviour to specify here.

## Alternatives Considered

**Carry the authorization request in a signed cookie.** No pending row and no sweep, at the
cost of making the parameter set a value the browser holds and replays: request lifetime
becomes cookie lifetime. Rejected.

**Prefix or wildcard redirect matching.** Convenient for clients with many environments,
and the most common source of authorization-server takeover, because a path or subdomain
under a registered origin is far easier to obtain than the origin itself. Rejected in
favour of exact registration plus the loopback port exception.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — the RPC boundary rules this endpoint's single call follows
- [ADR-012: Token Endpoint and Refresh Rotation](./ADR-012-token-endpoint-and-refresh-rotation.md) — verifies the bindings a code carries
- [ADR-015: Consent and Scopes](./ADR-015-consent-and-scopes.md) — owns `ConsentScreen` and the decision that follows it
- [ADR-009: Sessions](./ADR-009-sessions.md) — supplies the session ids and the authentication instant `max_age` compares against
- [ADR-014: Clients and Client Secrets](./ADR-014-clients-and-client-secrets.md) — owns the registered redirect URI set
