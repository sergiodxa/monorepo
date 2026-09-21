# ADR-038: Session Policy Configuration

## Status

**Proposed** - 2026-09-18

## Background

[ADR-009](./ADR-009-sessions.md) builds the session: a row in the tenant object, a `__Host-`
cookie carrying a high-entropy token, two clocks enforced on every resolve, and a published `sid`
that is not the bearer value. It fixes the defaults those clocks run on — 30 days absolute, seven
days idle — and names this ADR as the owner of a tenant's ability to change them.

Customers arrive with obligations the defaults do not meet. A payroll product wants an eight-hour
session that ends at the end of a shift. A regulated tenant has an auditor asking for a written
number. A consumer product wants the longest session the platform will give it. The mechanism to
serve all three already exists; what is missing is the surface that sets it and the bounds that
keep it sane.

Session policy configuration is a Pro and Premium feature. The security floor is not what is being
sold — every tier runs the same mechanism, the same revocation, the same cookie — and what a paid
tier buys is the ability to shorten the defaults to a number a tenant's own compliance obligation
names.

## Context

### A configuration surface over a security control is a set of bounds

A field that accepts any integer accepts a tenant typing a year into the absolute lifetime, and
the platform has then shipped a control whose worst setting it knows is wrong. Every knob below
therefore arrives as a range rather than a field, and a value outside it is refused at write time
with the bound in the message. The tenant chooses within a space the platform is willing to
defend.

### A stored expiry is an instant; a policy is a rule

ADR-009 computes `expires_at` and `idle_expires_at` when a row is written, so every live session
already carries the instants the old policy implied. A changed policy has to decide what those
rows mean, and the two directions are not symmetric. Shortening is a security decision a tenant
made deliberately and should not wait a month to take effect. Lengthening would extend an
authentication a person gave under the terms that were in force when they gave it.

### The cookie and the refresh token answer to different owners

The session is the tenant's own sign-on domain: one browser, one cookie, one row. A refresh token
belongs to a relying party and backs whatever application session that party keeps. They are
configured together because one screen is where a tenant looks for both, and they are bounded
independently because a client holding a long-lived refresh token is not the same risk as a
browser holding a long-lived cookie.

## Decision

### The knobs and their bounds

| Setting                            | Default         | Range                                        | Refused because                                                                                                                                |
| ---------------------------------- | --------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Absolute lifetime                  | 30 days         | 15 minutes – 90 days                         | Below the floor the redirect to `/authorize` outlives the session; above the ceiling an authentication stands for a quarter without re-proof   |
| Idle timeout                       | 7 days          | 5 minutes – the configured absolute lifetime | An idle window past the absolute lifetime is a setting that does nothing, and a setting that silently does nothing is worse than a refused one |
| Refresh token lifetime             | 30 days         | 1 hour – 180 days                            | A refresh token past half a year is a bearer credential with no practical expiry                                                               |
| Concurrent sessions per subject    | Unlimited       | 1 – 100, or unlimited                        | A limit of zero is an account nobody can use                                                                                                   |
| Sessions after a credential change | `revoke-others` | `revoke-others` or `revoke-all`              | Both values revoke, because a reset that leaves an attacker's session live is a reset that recovered nothing                                   |

Refresh token lifetime is the value the token endpoint's issuance and rotation read; the
mechanism belongs to _Token Endpoint and Refresh Rotation_ and this ADR supplies the number.

### The policy lives in the object

The policy is columns on the `settings` row the tenant object already holds, written by
`setSessionPolicy` and read by `resolveSession`. The object is the trust boundary for its own
rows, so the rule deciding when one expires belongs beside them rather than arriving as an input
on every call. The row is read once per instance and held in the object's memory, invalidated by
the one method that writes it, because a Durable Object is the only writer of its own settings —
so the read costs nothing per request.

### A change applies to live sessions by tightening only

`resolveSession` enforces the earlier of two instants: the one stored on the row, and the one the
current policy implies from `created_at` and `last_seen_at`. A shortened lifetime therefore takes
effect on the next request every live session makes, with no backfill and no job. A lengthened
one applies to sessions created after the change and leaves the rest on the terms they were
created under.

`setSessionPolicy` answers how many live sessions the new values will end, so the dashboard states
the consequence before the tenant confirms it.

The same comparison covers the concurrent limit and the entitlement. Lowering the limit does not
sign anybody out on its own; the next session a subject creates trims the oldest rows beyond the
limit, revoking them with reason `concurrent_limit` inside the creating operation, so the trim is
bounded by the limit and never a scan. And when a tenant's entitlement lapses — after the grace
window [ADR-018](./ADR-018-per-tenant-subscriptions.md) gives a past-due tenant — the
platform defaults return, except where the tenant's stored value is tighter, which continues to
apply. A downgrade freezes editing and never loosens a tenant's sessions.

### How the entitlement is evaluated

`entitlement.session-policy` is a boolean handle in the `@sdxc/flags/catalog` declaration,
defaulting to `false`, resolved through `ctx.flags` against the projection on the tenant's
control-plane row. The dashboard route and the management-API route that write the policy each
mount `requireEntitlement("session-policy")` from `@sdxc/billing/middleware`, so a tenant without
it never reaches the handler and the object is never asked to perform a denied capability.

Reading is open on every tier: `describeSessionPolicy` answers for anyone, because a Free tenant
asking what its session lifetimes are is asking about its own security posture, and the answer is
also the upgrade's whole argument.

### RPC methods

- `setSessionPolicy({ policy, actor })` — parses and bounds-checks every field inside the object,
  writes the settings row, writes the audit row naming the actor and the fields that moved, and
  answers the stored policy together with the count of live sessions the change shortens. The
  entitlement decided in the Worker governs who may ask; the bounds are the object's own, because
  a validator that lives only in the caller is one a second caller will not have.
- `describeSessionPolicy({})` — the effective values, the platform bounds, and which of the two is
  in force per field. A read-only document the Worker caches like the tenant's other read-only
  documents.

Enforcement adds no method. `resolveSession` reads the settings row it already has in memory, and
the concurrent trim happens inside the operations that create a session, because a session created
in one call and trimmed in another is one operation split in half.

## Consequences

### Positive

- A tenant with a compliance obligation writes its number into a field, and the platform refuses
  the numbers it would not be willing to defend.
- A shortened lifetime reaches every live session on that session's next request, with no
  migration over a table that grows with sign-ins.
- A lapsed subscription never loosens a tenant's sessions, so billing state and security posture
  move in one direction only.
- The security mechanism is identical on every tier, so the paid feature is the number rather than
  the protection.

### Negative

- Tightening-only means a tenant that lengthens a lifetime after a mistake finds its existing
  sessions still on the short clock, which reads as the setting not working.
- A concurrent limit of one signs a person out of their laptop when they sign in on their phone,
  which is what the setting means and not what everyone expects it to mean.
- Two lifetime numbers that look alike — the cookie's and the refresh token's — are configured on
  one screen and bounded separately, and a tenant will set one meaning the other.
- The bounds are platform judgements with no customer behind them yet, and widening one later is
  easier than narrowing it.

### Neutral

- A Free tenant runs the defaults, which are the same values a Pro tenant starts from.
- The policy is tenant state in the object rather than plan state in the control plane, so it
  survives a plan change and is restored in full when a subscription resumes.

## Alternatives Considered

**The policy on the tenant's control-plane row.** It rides the hostname resolution cache, so it
reaches the Worker with no read at all, and the Worker could pass the clocks into `resolveSession`.
It also makes the object's decision about when its own rows expire a function of an input its
caller supplies, which is the boundary rule inverted. Rejected.

**Recomputing `expires_at` on every live row when the policy changes.** The stored column stays
authoritative and the resolve stays one comparison. It is an unbounded write over a table that
grows with every sign-in, on a single-threaded object, triggered by someone saving a settings
form. Rejected in favour of comparing at resolve time.

**Per-client session lifetimes.** The most-asked version of this, because one relying party wants
fifteen minutes and another wants a month. The cookie is one single sign-on session shared across
every client, so a per-client lifetime over it is a contradiction. The mechanism that expresses
the requirement already exists in the protocol: a client sends `max_age` or `prompt=login` on its
authorization request and gets a fresh authentication. Rejected, and pointed at.

**Composition rules over a free-text policy document.** Expressive, and it would let a tenant
describe conditions the table above cannot. It ships a rule engine on the resolve path of every
request to the sign-in surface, to serve requirements nobody has stated yet. Rejected.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md)
- [ADR-009: Sessions](./ADR-009-sessions.md) — the mechanism this configures
- [ADR-007: Password Credentials](./ADR-007-password-credentials.md) — the credential change this bounds
- [ADR-020: Entitlements as Feature Flags](./ADR-020-entitlements-as-feature-flags.md) — how the gate is resolved
- ADR-012: Token Endpoint and Refresh Rotation — reads the refresh token lifetime set here
