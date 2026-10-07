# ADR-002: Client-Scoped Machine Endpoints

## Status

**Accepted** - 2026-10-07

## Background

A security review of the authorization server found that its machine endpoints trusted
any registered client to act on any token or subject. Three of them answered without
checking which client the token or person belonged to:

- `POST /oauth/token` with `grant_type=refresh_token` issued fresh tokens to anyone
  holding a session id, with no client authentication.
- `POST /oauth/introspect` told any authenticated client whether any token was live, and
  whose it was.
- `GET /api/subjects/:subjectId` returned any subject's profile, email and role included,
  to any client holding a `client_credentials` token. It kept doing so after the person
  revoked that app's access in the account area, which tells them the opposite.

The server is single-tenant and every client is a first-party app registered by its one
admin. That limits who could exploit these endpoints. It does not make the behavior
intended: the server's own rules already say confidential clients authenticate on every
token call, and the account area promises that revoking access cuts an app off.

## Context

### Fixed contracts

`apps/r3-auth/AGENTS.md` freezes two things that rule out some fixes:

| Contract                           | Consequence for this decision                                 |
| ---------------------------------- | ------------------------------------------------------------- |
| `sessions.id` IS the refresh token | A refresh token distinct from the session id is not available |
| The D1 schema                      | No new column for client capabilities or token bindings       |

### Public clients

Every client is confidential. `clients.secret` is `NOT NULL`, the admin area generates a
secret on create and offers no way to clear it, and every relying party in the repository
is built on `@sdxc/auth`'s `RelyingParty` with a `clientSecret`. RFC 9700 §4.14.2 says a
refresh token held by a public client must be sender-constrained or rotated, and this
server can do neither while the session id is the refresh token. A public client therefore
cannot redeem a refresh token here.

### Session ids in pages

The account area's device list (`resources/views/account/sessions.tsx`) and the admin
subject page put session ids in hidden form fields so a row can be revoked. Each of those
ids is a refresh token.

## Decision

Every machine endpoint answers a client only about tokens and people that belong to it.

1. **Refresh tokens are bound to their client.** The refresh grant authenticates the
   client first, through HTTP Basic or body credentials, like the code grant does.
   - No credentials: `401 invalid_client` with `WWW-Authenticate: Basic`.
   - A wrong secret, or a client with no secret: `400 invalid_client`.
   - A token issued to a different client: `400 invalid_grant` with the same description
     an unknown token gets.

   The account area's own guard refreshes as `AUTH_SERVER_CLIENT_ID`, the client its
   sign-in issues the session to.

2. **Introspection answers the token's own client or audience.** A token is reported as
   it is only to the client named in its `client_id`, or to a client its `aud` names. Any
   other caller gets `{ "active": false }`, the answer a token never issued gets
   (RFC 7662 §4).
3. **The subject API answers about people who authorized the caller.** A client reads a
   subject only while that subject holds a `grants` row for it. Every authorization writes
   one, and revoking access in the account area deletes it. Without one the answer is the
   missing-subject `404`. The grant is checked ahead of the per-client KV cache, so a
   revocation applies on the next request.
4. **Session ids stay in the revoke forms.** Once (1) and (2) are in place, a session id
   on its own mints nothing and reveals nothing: refreshing, revoking or introspecting it
   needs the owning client's secret. The device list keeps working as it does.

The admin subject page's single-session revoke is now scoped to the subject the page
names as well, so a session id posted against the wrong account deletes nothing.

## Consequences

### Positive

- **A leaked session id is inert.** A refresh token copied from a page, a log or a device
  is useless without the client secret it was issued with.
- **Revoking an app's access is honored everywhere.** The subject API stops answering for
  that person on the next request.
- **No token scanning.** A client cannot use introspection to learn which of another
  client's tokens are live.

### Negative

- **Grants only exist since February 2026.** The `grants` table arrived in migration
  `20260217235901`, with no backfill. A person whose last authorization of a client
  predates it has no grant, and the subject API answers that client `404` for them until
  they sign in to it again. `apps/uptime` resolves team members through this API for the
  member list, the team digests and account-deletion notices. For a member who has not
  signed in to Uptime since then, until their next sign-in, the team page shows them by
  subject id, and the digest and deletion-notice jobs skip them with a logged warning.
  Nothing is deleted.
- **Resource servers introspect by client id.** A `client_credentials` token minted with
  `resource=<url>` names that URL in `aud`, not a client id, so the resource server behind
  that URL cannot introspect it. No deployed app introspects today.

### Neutral

- **Relying parties change nothing.** `@sdxc/auth` already sends client credentials on
  every token request, refresh included.
- **Response shapes are unchanged.** Every refusal reuses an envelope the endpoint already
  returned.

## Alternatives Considered

### 1. A refresh token distinct from the session id

This would take the refresh token out of the account and admin pages entirely. It needs a
new column, and it breaks the frozen `sessions.id` contract and every relying party's
stored tokens. Binding the token to its client achieves the same protection without
either.

### 2. A per-client allow-list for the subject API

Only `apps/uptime` calls the subject API, so an allow-list naming it would close the
endpoint to every other client. It needs a schema change or a configuration value holding
production client ids. It also still lets an allowed client read people who revoked its
access. Consent grants already record the relationship and are maintained by the
authorization flow itself.

### 3. Accepting a public client's refresh with `client_id` alone

OAuth 2.1 lets a public client identify itself with `client_id` on refresh, but only when
the refresh token is sender-constrained or rotated (RFC 9700 §4.14.2). This server does
neither, and no public client exists.

## References

- [RFC 6749 §6](https://www.rfc-editor.org/rfc/rfc6749#section-6) - Refreshing an Access Token
- [RFC 7662 §4](https://www.rfc-editor.org/rfc/rfc7662#section-4) - Introspection Security Considerations
- [RFC 9700 §4.14](https://www.rfc-editor.org/rfc/rfc9700#section-4.14) - Refresh Token Protection
- [ADR-001](./ADR-001-port-auth-to-remix-v3.md) - Port of the authorization server to Remix v3
