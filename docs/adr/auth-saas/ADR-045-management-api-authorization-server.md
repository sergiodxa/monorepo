# ADR-045: Management API Authorization Server

## Status

**Superseded** by [ADR-046: Platform Tenant as the Management API's Authorization Server](./ADR-046-platform-tenant-as-management-authorization-server.md) - 2026-09-28.
This ADR's own new authorization server (its own client table, authorization codes, and refresh
tokens, parallel to the tenant OIDC engine) turned out to be unnecessary: the platform tenant is
already a complete authorization server, and reusing it directly needs far less new surface.

## Background

Every route the management API serves is reachable today by exactly one credential shape:
`client_credentials`, a tenant's own management client presenting an id and a secret it holds —
no person and no interactive consent involved. That fits a script or a scheduled job. It does not
fit a person sitting down to use the platform: there is no dashboard, and there is no way for an
agent a person is running (an MCP client, a CLI) to ask that person to sign in and pick what it
may do on their behalf. ADR-043/044 built a real platform sign-in, but signing in only proves who
someone is — it grants no access to the management API at all, by the design ADR-034 already
committed to: the two credentials share no scope vocabulary, issuer, or audience, on purpose.

A dashboard, an MCP server, and a CLI are the same shape of problem: a client a person is using
needs to ask that person, once, what it may do on their behalf, and hold a token answering exactly
that — the interactive counterpart client-credentials never covered. This ADR builds it, once, as
its own first-class capability the management API serves, rather than bolting a special case onto
the dashboard or onto the MCP server this unblocks.

## Context

### One authorization server, not a login followed by a translation

The instinct to reach for is: sign in normally, then hand that proof to some second step that
converts it into a management token. That framing is wrong. The management API is its own
resource with its own authorization server, the same way any OAuth-protected resource has one; a
dashboard is simply its first client, not a special path in front of it. What is reused from the
platform tenant's own sign-in is only the *identity substrate* — the session that already proves
who a person is — not a token this flow then exchanges. The authorize step itself, and the
consent it renders, are net new: pick which organization, review which scopes, and the token
endpoint mints a `ManagementAccessToken` directly, in the one grant that flow ends in.

### Where each piece is served

The management API's own issuer is already `https://api.{PLATFORM_DOMAIN}` — every
`ManagementAccessToken` `client_credentials` already mints carries it as `iss`
(`app/services/management-token-grant.ts`). This flow's token endpoint stays there, a second grant
type beside the one `app/http/controllers/management/token.ts` already serves. Its *authorize* and
*consent* pages, though, need the platform tenant's own session cookie in the same request — a
`__Host-` cookie is bound to one exact host and cannot cross to `api.{PLATFORM_DOMAIN}`'s own
origin — so they render on the platform's own bare domain instead, alongside `/signup` and the
`/u/*` pages ADR-044 already forwards there. An unauthenticated visit to `/oauth/authorize`
redirects to `/u/sign-in?return_to=/oauth/authorize?...`, the same `return_to` escape hatch
`hosted/sign-in.tsx` already supports for a caller with no OIDC interaction of its own — and lands
back on the authorize page once signed in, cookie now present, same origin throughout. Only the
final code-for-token exchange — a server-to-server POST with no browser involved — crosses to
`api.{PLATFORM_DOMAIN}`, where discovery already says the token endpoint lives.

### What the consent screen resolves against

ADR-034 already states the rule this flow implements rather than invents: a member's
`memberships.role` resolves to a scope set — owner to every scope, admin to all but member
management and tenant deletion, member to the read scopes. The authorize step lists every
organization the signed-in subject administers (`Membership.listByTenant`'s own inverse — every
tenant a subject holds a membership on), the person picks one, and the requested scopes are
intersected against that membership's own resolved ceiling before consent ever renders — a request
for a scope the person's own role does not carry is dropped before they see it, not merely refused
afterward.

### A code needs somewhere to live between authorize and token

The tenant OIDC engine's own `authorization_codes` table (`database/authorization.ts`) is the
right shape to mirror — a single-use, PKCE-bound row read once and marked spent — with the fields
this flow actually has: the client, the redirect URI, the code challenge, which subject consented,
which organization and scopes they granted, and its own expiry. It carries no `session_id`,
`nonce`, or `auth_time`: those name a browser-facing OIDC interaction this flow has none of.

### A standing credential to mint the next token from

`client_credentials` never needs a refresh token — the caller holds its id and secret and can ask
again anytime. An authorization-code-derived grant has no such standing credential: the person who
consented is not present fifteen minutes later when an MCP session is still open. This flow mints
a refresh token the same way the tenant engine's own token endpoint already does — a rotating
family, each redemption issuing the next member and revoking the whole family on a replay
(`database/tokens.ts`'s existing idiom) — scaled to what this flow actually carries: no `session_id`
to revoke sessions through, since there is no session behind a management token, only the
organization and scopes the original consent granted.

### Client identification: DCR, and CIMD for the ecosystem built for it

A management client used interactively is a different kind of thing from the confidential,
admin-registered `management_clients` row `client_credentials` already reads — it is typically
public (no secret an MCP server or a CLI can keep), and its whole point is being usable without a
tenant admin registering it by hand first. Two paths register one:

- **Dynamic Client Registration** (RFC 7591), a `POST /oauth/register` a client calls once, itself,
  the general mechanism for anything that wants to register ahead of its first authorize call.
- **Client ID Metadata Documents**, for an MCP server specifically: the client's own `client_id` is
  an `https://` URL it hosts a metadata document at, fetched and validated at authorize time —
  built for exactly the ecosystem MCP is, and it stores nothing for a client that never returns.

Both resolve to the same shape by the time authorize runs: a redirect URI to validate against, a
display name for the consent screen, and whether the client is confidential or public. Neither
carries a scopes *ceiling* the way an admin-registered `management_clients` row does — for this
grant, the person's own membership role is the ceiling, not a value someone configured for the
client ahead of time.

### The dashboard is this flow's first client, not a reason to special-case it

Once this exists, the minimal dashboard ADR-043/044 already leaves a gap for is simply a browser
client of it: it runs the same authorize/consent/token flow (no client secret to keep, since it is
a first-party public client, PKCE covering it the same as any other), holds the resulting token the
same as any other client would, and calls the same, already-built, already-tested management API
routes to render its pages. Its own page inventory is a separate ADR; this one stops at making that
possible.

## Decision

1. `management_oauth_clients` — a new control-plane table for a client used *interactively*: id,
   name, redirect URIs, `kind` (`confidential`/`public`), secret hash (nullable, for `confidential`
   only), and how it was registered (`admin`, `dynamic`, or `cimd`) — kept apart from
   `management_clients`, whose whole point is a tenant admin's own, ahead-of-time-vetted credential.
2. `management_authorization_codes` — single-use, PKCE-bound, naming the client, redirect URI,
   consenting subject, chosen tenant, and granted scopes; spent atomically the same way the tenant
   engine's own codes are.
3. `management_refresh_tokens` — a rotating family per grant, mirroring `database/tokens.ts`'s
   existing reuse-detection idiom, scaled to carry no session.
4. `GET/POST /oauth/authorize` and the consent screen, served on the platform's own bare domain
   (`routes/web.ts`/`bootstrap/app.ts`), gated on the existing session (redirecting to `/u/sign-in`
   with `return_to` when absent), listing the signed-in subject's own administered organizations and
   the requested scopes intersected against the chosen one's resolved role.
5. `POST /oauth/token` gains `grant_type=authorization_code` and `grant_type=refresh_token` beside
   its existing `client_credentials` handling, both minting the same `ManagementAccessToken` shape
   client-credentials already produces, audienced and scoped identically.
6. `POST /oauth/register` (RFC 7591 Dynamic Client Registration) and Client ID Metadata Document
   support at authorize time, both writing (or, for CIMD, never needing to write) a
   `management_oauth_clients` row.

## Consequences

### Positive

- One authorization server serves every interactive Management API client — the dashboard, the
  platform's own future MCP server, a customer's own CLI — through the same flow, the same
  consent screen, and the same token shape `client_credentials` already produces and every
  existing management route already accepts unchanged.
- A management token's ceiling is always the consenting person's own real, current role — never a
  value fixed at registration time that can drift from what they are actually allowed today.
- CIMD lets an MCP server connect with zero pre-registration, the ecosystem it exists for.

### Negative

- Three new tables and a second grant family (authorization code plus its own refresh rotation) is
  real, security-sensitive surface to build and keep correct — this is the largest single piece of
  work in this ADR series so far.
- A refresh token now exists for the management API where none did before, which is a credential
  with its own lifetime to reason about and revoke.

### Neutral

- The dashboard's own page inventory, and the platform's own Management MCP server built on top of
  this flow, are each their own follow-up ADR; this one ends at the authorization server existing.

## Alternatives Considered

**A translation step: sign in normally, then exchange that proof for a management token.** Two
hops instead of one, and a second thing to keep consistent with the first. Rejected in favor of a
single, purpose-built authorize/consent/token flow whose only output is a management token.

**Only Dynamic Client Registration, no CIMD.** DCR alone works, but requires a client to complete a
registration call and requires the platform to hold a row for every one that ever connects, even a
personal MCP client nobody else uses. CIMD costs nothing to support alongside it and fits the
ecosystem this unblocks.

**A scopes ceiling on `management_oauth_clients`, the way `management_clients` has one.** Rejected:
for an interactively-consented grant, the person's own role is already the real ceiling: a second,
separately configured one only invites the two to drift apart.

## References

- [ADR-034: Management API](./ADR-034-management-api.md) — the scope vocabulary, the `client_credentials` grant, and the role-to-scope resolution this flow reuses unchanged
- [ADR-043: Platform Onboarding](./ADR-043-platform-onboarding.md) — the platform tenant subject and session this flow's identity substrate is
- [ADR-044: Platform Sign-Back-In](./ADR-044-platform-sign-back-in.md) — the sign-in page and `return_to` escape hatch authorize redirects through
- [ADR-012: Token Endpoint and Refresh Rotation](./ADR-012-token-endpoint-and-refresh-rotation.md) — the reuse-detection idiom this flow's own refresh tokens mirror
