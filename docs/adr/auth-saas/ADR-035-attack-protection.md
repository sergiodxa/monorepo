# ADR-035: Attack Protection

## Status

**Proposed** - 2026-09-18

## Background

Every endpoint this platform serves is reachable by anyone who knows a tenant's hostname, and the
interesting ones take a credential, so the traffic is a mixture of people signing in and machines
replaying a breach corpus. The credential designs answer one attempt: a password hashed under one
algorithm and compared in constant time, a passkey assertion bound to an origin, a TOTP code that
buys one try. None answers the millionth. That is this ADR — how many attempts a caller gets,
against which key, who pays for counting them, and what a tenant sees while it happens.

Attack protection and rate limiting are a base feature, on every tier including Free: a free-tier
tenant is the one most likely to be probed first, and leaving the weakest tenants undefended
defends the platform's own reputation badly.

## Context

### A counter keyed on something a caller mints is an unbounded table

[ADR-007](./ADR-007-password-credentials.md) puts a deliberate key derivation inside a
single-threaded Durable Object, so an anonymous sign-in attempt is how a stranger schedules CPU on
a tenant's object: a refusal decided in the Worker costs that tenant nothing, one decided in the
object costs a round trip and a turn.

Storage pushes the same way. A failure counter keyed on the identifier that was typed is
attractive until a script types a million addresses resolving to nobody: each wants a row, the
rows are the tenant's finite per-object storage, and the attacker chose the keys. A counter per
source address inside the object fails identically. So one rule stands behind every counter below.
A counter whose key a caller can invent lives in a platform rate limiter, which forgets on its own
schedule and costs no storage; a counter whose key is a row that already exists — a subject —
lives on that row, growing with the directory rather than with the attack.

### Lockout is a denial-of-service primitive

| Response to repeated failure | Costs an attacker | Costs the account holder |
| --- | --- | --- |
| Lock until an administrator clears it | One run of failures | The account, until someone answers a ticket |
| Lock for a fixed window | A pause per window | The account, for that window, on demand |
| Exponential backoff with a ceiling | A geometric climb against a search needing thousands of tries | Seconds after a typo, minutes at worst |

A guessing attack needs volume, so geometric growth ends it early. A lock ends it too, and hands
anyone who knows an address a free way to keep its owner out. Backoff is the choice, ceilinged
because the backoff is itself a small denial of service.

## Decision

### Three counters, three homes

| Counter | Key | Home |
| --- | --- | --- |
| Requests per endpoint class | Client address from `getClientIP`, IPv6 bucketed by `/64` | `CloudflareAdapter` over a rate limiter binding |
| Requests per tenant per endpoint class | Tenant id | `CloudflareAdapter` over a rate limiter binding |
| Consecutive authentication failures | Subject id | `failed_attempts` and `retry_after` on the subject's credential row |

Nothing in the object counts anonymous traffic, so no table grows with an attack, and the two
columns are set by the statement that records the verification result, so the counter neither adds
a row nor spans an `await`. From the tenant's threshold — 4 consecutive failures by default,
settable from 3 to 10 — the delay doubles from one second to a 15-minute ceiling. A success clears
the counter, an untouched counter decays after 24 hours.

During a backoff window the object skips the real verification and answers what a wrong password
answers, spending the same dummy derivation [ADR-007](./ADR-007-password-credentials.md) already
spends for an unknown identifier. The window is therefore invisible: it teaches a caller nothing
about who is registered, and no response calls an account locked, because none is. The per-address
budget at the edge keeps a burst off the object; the per-subject counter exists for the distributed
case, where many addresses each stay under that budget while working one account.

### Rate limiting across the endpoint classes

One `rateLimit` registration from `@sdxc/rate-limit/middleware` per protected surface, each with
an explicit `prefix` and `key`, over `CloudflareAdapter` bindings.

| Class | Routes | Key | Budget | `failurePolicy` |
| --- | --- | --- | --- | --- |
| Interactive credential | `/u/sign-in`, `/u/sign-up`, `/u/reset`, the second-factor post | Address | 10 / 10 s | `closed` |
| Mail-sending | Reset request, verification resend, magic-link request | Folded identifier, else address | 5 / hour | `closed` |
| Token | `/oauth/token` | Authenticated client id, else address | 60 / 10 s | `open` |
| Authorization | `/authorize` | Address | 30 / 10 s | `open` |
| Read-only protocol | `/.well-known/*`, `/userinfo` | Address | 120 / 10 s | `open` |
| Management API | Every route | Token id | 120 / 60 s | `open` |

The two `closed` surfaces are where an uncounted attempt is worse than a refused one: a limiter
outage must not become unlimited guessing or unlimited mail. Elsewhere `open` holds, since an
outage should not stop a paying tenant's users signing in. Either way it is logged as
`rate_limit.unavailable` with the policy applied. A refused request answers through `onLimit`, so
hosted screens return HTML and protocol endpoints return the JSON `error: "too_many_requests"`
body, both carrying the `RateLimit`, `RateLimit-Policy` and `Retry-After` fields the decision
supports. A failed sign-in spends beyond the request: the controller calls `adapter.consume(key,
4)` after a refusal, the adapter's no-request path, so an address working a list runs out several
times faster than one whose users mostly succeed.

### Bot detection

Turnstile in managed mode, under the platform's own site key and secret, so no tenant holds a
third-party account. It runs unconditionally on `/u/sign-up`, and on `/u/sign-in` and `/u/reset`
once the address has spent half its credential budget — so ordinary sign-in stays the plain
server-rendered form [ADR-016](./ADR-016-hosted-sign-in-ui-and-branding.md) requires, and the
challenge appears for the caller who has been failing. The token is verified server-side, failing
closed on sign-up, where a refusal costs one person one retry, and open on sign-in, where a vendor
outage would otherwise stop every tenant's users at once.

### Enumeration resistance, flow by flow

| Flow | What an unknown identifier gets |
| --- | --- |
| Password sign-in | The dummy derivation, `invalid_credentials`, one shape and one timing |
| Passkey sign-in | No identifier is typed: the ceremony is usernameless |
| Sign-up | Accepted, and the address is mailed — a verification link, or a notice that an account already exists |
| Password reset, magic link, identifier change | One return shape whether or not a ticket was minted, and the address is mailed either way |
| Second factor | Reached only inside an authenticated step, so no identifier is taken |
| Management API | The truth, because the caller is the directory's owner |

The last row is the boundary: enumeration resistance protects anonymous surfaces, and hiding a
tenant's directory from that tenant is not a security property.

### What a tenant can see

Attack signals are analytics data points indexed by tenant id — surface, outcome class, refusal
reason, coarse geography, counts — written on the path the cost ledger uses. They are cheap,
queryable for 90 days on every tier, and consume none of the object storage the directory needs.
The dashboard's security screen queries them for failed sign-ins per hour against the tenant's own
trailing baseline, distinct identifiers per address, backoff activations, challenge refusals and
limited requests, and a scheduled job mails the tenant's owners at most once a day when that rate
stands well above baseline — a notification, never an enforcement. The audit log keeps only
decisions naming one subject, which keeps
[ADR-023](./ADR-023-audit-log-and-retention.md)'s catalog closed.

### Configured versus fixed

| Setting | Owner |
| --- | --- |
| Failure threshold before backoff begins, 3–10 | Tenant, default 4 |
| Challenge on sign-up; alert recipients and whether alerts are sent | Tenant |
| Backoff curve, its 15-minute ceiling, every budget above | Platform |
| Enumeration-resistant responses, the breached-password deny-list | Platform, always on |
| An address exemption list | Not offered |

An exemption list is the one request this refuses: the address that most wants one is a shared
corporate egress, exactly where a credential-stuffing run hides, and an exemption outlives the
reason it was opened. The budgets are sized so an ordinary shared egress never trips them.

### RPC surface

This adds no table and one method: `signInWithPassword` and the second-factor operations read and
write the two counter columns inside the call that already verifies the credential and answer a
`retryAfter` beside their existing result, while `clearAuthenticationBackoff({ subjectId, actor,
reason })` is the administrator's undo — a complete operation resetting the counter and writing
its audit row.

## Consequences

### Positive

- Anonymous traffic is counted where keys are free and forgotten on their own, so an attack
  consumes none of the tenant's finite object storage, and the per-subject counter is two columns
  set by a statement that was already writing.
- A refusal is indistinguishable from a wrong password, and a tenant still sees the attack in its
  dashboard without an audit row per attempt.

### Negative

- Backoff is still a small denial of service: someone who knows an address can keep its owner
  waiting up to fifteen minutes, and the ceiling bounds that rather than removing it.
- Keying on an address means a shared egress shares a budget, so an office behind one trips a
  limit its individual users did not earn.
- Bot detection is a third-party dependency on sign-up: failing closed there means a vendor
  outage stops registrations, and a visitor without JavaScript cannot sign up at all.

### Neutral

- The Cloudflare adapter reports no `remaining`, so a `429` here carries the limit and the reset
  without a remaining count, and a tenant with unusual egress gets a support conversation.

## Alternatives Considered

**Account lockout with an administrator unlock.** What most buyers ask for by name, and it reads
well on a checklist. It converts knowledge of an address into the power to remove its owner, with a
support ticket as the remedy. Rejected for a bounded backoff.

**Counting failures per typed identifier inside the tenant object.** Catches the attack a step
earlier, before a subject is resolved. The key is whatever a caller typed, so the table is one an
attacker sizes, in storage the tenant pays for. Rejected.

**A CAPTCHA on every sign-in.** Simple to explain and uniformly applied. It taxes every honest
sign-in on a page that is otherwise script-free, against an attacker who buys solutions by the
thousand. Rejected for challenging the caller who has been failing.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md)
- [ADR-007: Password Credentials](./ADR-007-password-credentials.md) — the derivation this bounds
- [ADR-016: Hosted Sign-in UI and Branding](./ADR-016-hosted-sign-in-ui-and-branding.md)
- [ADR-023: Audit Log and Retention](./ADR-023-audit-log-and-retention.md)
- [ADR-026: TOTP Second Factor and Recovery Codes](./ADR-026-totp-second-factor-and-recovery-codes.md)
- [root ADR-019: Adapter-Based Rate Limiting Package](../ADR-019-adapter-based-rate-limiting-package.md)
