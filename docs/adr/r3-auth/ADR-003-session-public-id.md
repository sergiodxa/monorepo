# ADR-003: Session Public Id Apart from the Refresh Token

## Status

**Accepted** - 2026-10-12

## Background

A session's primary key `sessions.id` was also its refresh token. The same value went out
to relying parties as the `sid`: in the front-channel logout URL each iframe loads, and as
the `sid` claim of back-channel logout tokens. Every relying party that asked for
session-specific logout therefore received a working refresh token for sessions that were
not its own. It also landed in browser history, `Referer` headers and request logs.

[ADR-002](./ADR-002-client-scoped-machine-endpoints.md) made a leaked token require its
client's secret to redeem. That narrows the damage but leaves the refresh token in places
it should never be, including the database in plaintext.

## Context

| Where the value went           | Who sees it                                      |
| ------------------------------ | ------------------------------------------------ |
| Front-channel logout URL `sid` | Every relying party, browser history, its logs   |
| Back-channel logout token      | Every relying party with session-specific logout |
| Account and admin revoke forms | The page's HTML                                  |
| `sessions.id` column           | Anyone with a database read                      |

The authorization code is stored in KV with the session's id, and the code grant answered
with that id as the refresh token when the request asked for `offline_access`.

## Decision

1. **`sessions.id` is a public UUID** (`generateUUID` from `@sdxc/uuid/v4`). It is the
   `sid` in both logout channels, the value the revoke forms post, and the session the
   authorization code names. It authenticates nothing.
2. **The refresh token is minted at code redemption**, with `randomToken()`, only when the
   request asked for `offline_access`. A session that never earns one has none.
3. **Only the token's SHA-256 hash is stored**, in `sessions.refresh_token_hash` (unique).
   A 256-bit random token needs no salt or stretching, and a deterministic digest lets a
   presented token find its row by equality. `Sessions.findByRefreshToken` is the one way
   in, used by the refresh grant, revocation, introspection, logout and the account area's
   "current session" marker.
4. **Refreshing hands back the same token.** Rotation stays out of scope; the token lives
   as long as the session.

### Migration

The migration (`20261012000000_session_public_id.sql`) deletes every session, then adds
`refresh_token_hash` with a unique index. Every existing id was a refresh token, and any
that went out as a `sid` must be treated as leaked, so none is carried over. D1 has no SQL
hash function, so keeping them would mean storing plaintext until each was next used.

## Consequences

### Positive

- **A `sid` refreshes nothing.** Relying parties, browser history and logs only ever see the
  public id.
- **A database read yields no usable token.** Only digests are stored.
- **Every possibly leaked token is dead** the moment the migration runs.
- **Sessions without `offline_access` hold no refresh token at all.**

### Negative

- **Everyone signs in again.** Each relying party's next refresh answers `invalid_grant`,
  and the account area sends its browser back to sign-in. This server is single-tenant, so
  that is one person re-authenticating each app.
- **Sessions opened between the migration and the deploy cannot refresh.** The previous
  code still names a session by its token and stores no hash; those clients sign in again
  on their first refresh, as everyone else does.

## Alternatives Considered

### 1. Keep existing refresh tokens working

Moving each old id into a plaintext column and hashing it on first use would spare the
re-authentication. It keeps tokens that already went out as `sid` valid for up to 30 days,
and keeps plaintext in the database until then.

### 2. Carry the refresh token in the authorization code's KV entry

Minting the token at authorization time and storing it with the code would keep the code
grant unchanged. It puts a plaintext token in KV for the code's lifetime and gives sessions
that never earn a refresh token one anyway.
