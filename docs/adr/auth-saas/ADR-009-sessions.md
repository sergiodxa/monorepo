# ADR-009: Sessions

## Status

**Proposed** - 2026-09-18

## Background

A subject proves who they are once — with a password or a passkey — and a client then sends
them to `/authorize`. The proof has to still be there when they arrive, and still be there when
a second client sends them an hour later. That surviving proof is the session, and it makes a
tenant a single sign-on domain rather than a sign-in form per relying party. It belongs to the
tenant's own sign-in surface: a relying party receives an authorization code and exchanges it
for tokens, and whatever application session it keeps afterwards is its own.

[ADR-001](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) puts a tenant's state inside
its Durable Object and gives the Worker HTTP. A session sits on that seam: the record is tenant
state, the cookie is an HTTP artifact, and the lookup runs on every request to the sign-in host.
Sessions are a base capability, available on Free; per-tenant configuration of the lifetimes
below is Pro and above, owned by _Session Policy Configuration_, so this ADR fixes the defaults
and the mechanism a policy adjusts.

## Context

### The cookie value is a bearer credential; the record id is not

Whoever holds the cookie value is the subject, which makes it the most dangerous string in the
system and the wrong thing to publish. An ID token carries a `sid` claim so a relying party can
correlate a session with a logout, and the account UI needs a handle to revoke by. Two values
with two jobs settle it: a high-entropy token the browser carries, and a record id safe to hand
out.

### The read path runs per document, not per asset

The objection to a server-side session is a round trip per request. That follows only when the
lookup is mounted on everything. The session middleware runs on the routers that render the
sign-in surface and act on it, while static assets are served by the asset handler, which reads
no cookie. `/authorize` resolves the session inside `beginAuthorization`, so the single sign-on
decision is the one round trip ADR-001 budgets for that endpoint rather than two. And sliding
the idle window is throttled — `last_seen_at` is written when it has moved by more than a
minute — so a page and its form post share one write.

### Two clocks answer two different questions

| Clock    | Question it answers                                                              | Default |
| -------- | -------------------------------------------------------------------------------- | ------- |
| Absolute | How long may one authentication stand before the subject proves themselves again | 30 days |
| Idle     | How long may an authentication sit unused before it stops standing               | 7 days  |

An absolute lifetime bounds a token stolen and held; an idle lifetime clears the abandoned
session on a shared machine. Both are enforced on every resolve.

### The subject is the one who recognizes a session

A session list is useful only when a row reads as a place and a device. A request through
Cloudflare carries the connecting address and the `cf` object's coarse location, and the
`User-Agent` names the browser. Those go on the row as they arrived and become a label at render
time, so the rules that turn a string into "Safari on macOS" change without a stored value
going stale.

## Decision

### The record

One table in the tenant object, a `remix/data-table` model over `@sdxc/data-table-sqlstorage`.

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,               -- sess_… TypeID, published as the `sid` claim
  token_hash TEXT NOT NULL UNIQUE,   -- SHA-256 of the cookie's token, hex
  subject_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,       -- epoch milliseconds throughout
  auth_time INTEGER NOT NULL,        -- last full authentication; feeds `auth_time` and `max_age`
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,       -- created_at + absolute lifetime
  idle_expires_at INTEGER NOT NULL,  -- last_seen_at + idle lifetime
  amr TEXT NOT NULL,                 -- JSON array: ["pwd"], ["webauthn"], ["pwd","otp"]
  remembered INTEGER NOT NULL,
  ip TEXT, user_agent TEXT, country TEXT, region TEXT, city TEXT,
  revoked_at INTEGER, revoked_reason TEXT
);
CREATE INDEX sessions_by_subject ON sessions (subject_id, created_at DESC);
CREATE INDEX sessions_by_expiry ON sessions (expires_at);
```

The cookie's token is `randomToken({ bytes: 32 })` from `@sdxc/crypto`, and storage keeps its
SHA-256. The digest is a plain one because the row is _found_ by it: the value is 256 bits the
object generated, so a work factor would be paid on every request to slow a search nothing can
walk. A credential located some other way and then compared is hashed under the repo's
credential-hash decision, which is what _Clients and Client Secrets_ does.

### The cookie

Built with `createCookie` from `remix/cookie` and signed with the app's cookie secrets, a list
that rotates without invalidating live sessions.

| Attribute  | Value                                                | Why                                                                                                                                               |
| ---------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name       | `__Host-session`                                     | The prefix binds the cookie to one exact host and forbids `Domain`, so another name under the customer's domain can neither read nor overwrite it |
| `HttpOnly` | yes                                                  | The bearer value stays out of reach of page script                                                                                                |
| `Secure`   | yes                                                  | Required by the `__Host-` prefix, and the token travels on every request                                                                          |
| `SameSite` | `Lax`                                                | `/authorize` is reached by a top-level cross-site navigation, which `Lax` carries the cookie through                                              |
| `Path`     | `/`                                                  | Required by the `__Host-` prefix                                                                                                                  |
| `Max-Age`  | Remaining absolute lifetime, on a remembered session | An unremembered session lives as long as the browser keeps it                                                                                     |

The signature is verified in the Worker, so a forged or edited cookie is refused before a call
reaches the object.

### RPC methods

Each parses its input with `remix/data-schema` inside the object and returns plain values.

- `resolveSession(input)` — takes the token, the wall clock, and the request's address, agent
  and location. It hashes and looks up, enforces both clocks, slides the idle window, records
  last-seen, and answers `{ status: "active", sessionId, subjectId, authTime, amr, expiresAt,
idleExpiresAt }` or `{ status: "expired" | "revoked" | "unknown" }` — a whole operation,
  attach this request to its session, which is why the write it performs lives inside it.
- `listSubjectSessions(input)` — a page of summaries for the account UI: id, creation,
  last-seen, methods, agent, address, location, and whether the row is the caller's own.
  `created_at` and `id` stay in the projection, since the cursor is minted from the returned row.
- `revokeSession(input)` — takes subject and session id together and revokes only when the row
  belongs to that subject, so the authorization lives where the data does.
- `revokeSubjectSessions(input)` — revokes every session for a subject, optionally sparing one,
  and answers the count; a password change calls it.
- `sweepExpiredSessions(input)` — deletes rows past absolute expiry in bounded batches and
  reports whether more remain, driven by the scheduled handler.

Creating a session is not a method here: `authenticateWithPassword` and the passkey assertion
each end by writing the row and returning the token, because a credential checked in one call
and a session created in another is one operation split in half.

### What authentication writes

| Event                                                          | Effect on the session                                                                           |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| First factor accepted                                          | A new row, with `auth_time`, `amr` and both clocks set                                          |
| Second factor accepted                                         | `amr` gains the method, on the same row                                                         |
| Re-authentication from `prompt=login` or an exceeded `max_age` | A fresh token into the same row with `auth_time` moved forward, so the published `sid` survives |
| A request through the session middleware                       | `last_seen_at` and the idle window, throttled to a minute                                       |
| A password changed or a credential removed                     | Every other session for the subject revoked                                                     |
| Sign-out                                                       | `revoked_at` and a reason on the one row                                                        |

Re-issuing the token on re-authentication is also what closes session fixation: the value a
browser held before the privilege change stops resolving.

## Consequences

### Positive

- Revocation is immediate and total, because the authority is a row the next resolve reads.
- The value published to relying parties is the record id, so a compromised client learns a
  handle, and a stolen row yields a digest.
- The account UI shows where and on what a session is live, which is what makes a "not me"
  revocation possible at all.

### Negative

- Every rendered page on the sign-in host costs a round trip to the object, and a slow object
  is a slow sign-in surface.
- Sliding the idle window is a write, so an active subject writes rows all day; the throttle
  bounds that to one a minute rather than removing it.
- The table grows with every sign-in and shrinks only on the sweep, so retention depends on a
  scheduled job that has to keep running, and a subject who meets the absolute lifetime mid-task
  is prompted at a moment nothing they did explains.

### Neutral

- Address and coarse location live on the row as long as the session does and leave with it.
- `SameSite=Lax` is a deliberate ceiling here; CSRF on the sign-in surface is carried by the
  CSRF middleware rather than by the cookie attribute.

## Alternatives Considered

**A stateless cookie carrying signed claims.** No lookup at all, which removes the round trip
and is the appeal. It also makes revocation a promise the system cannot keep: a signed claim
stays true until it expires, so a stolen cookie survives sign-out and the account UI can list
nothing. Rejected — for an identity provider, revocation is the feature.

**The session record in KV, keyed by the token.** Fast global reads and no load on the object.
KV is eventually consistent, so a revoked session keeps resolving somewhere for as long as
propagation takes. Rejected.

**One identifier serving as both the cookie value and the `sid` claim.** One column and one
concept, which publishes the bearer credential to every relying party. Rejected.

**`SameSite=Strict`.** The stronger attribute, and right for a cookie that never crosses a site
boundary. This one always does: the redirect to `/authorize` originates at the client, and
`Strict` drops the cookie on that navigation and prompts again. Rejected as incompatible with
single sign-on.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — the boundary rules these methods follow
- [ADR-002: Rebuild Path and Implementation Order](./ADR-002-rebuild-path-and-implementation-order.md) — why sessions land before the authorization endpoint
- ADR-011: Authorization Endpoint and PKCE — resolves the session inside `beginAuthorization`
- ADR-038: Session Policy Configuration — per-tenant lifetimes, Pro and above
