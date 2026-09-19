# ADR-039: Device Authorization Grant

## Status

**Proposed** - 2026-09-18

## Background

Some things a tenant's customers sign into have no browser worth using: a television app, a set-top
box, a command-line tool on a build machine, a meeting-room display. The authorization code flow
assumes a browser on the device, and typing an address and a password with a remote control is what
that assumption produces.

RFC 8628 answers it by moving the sign-in to a device the person already holds: the device asks for
a pair of codes, shows one and polls, while the person opens a short URL on a phone, enters that
code and approves.

This is the **Device authorization grant** add-on at $9 per tenant per month, the cheapest in the
catalog because it is the narrowest: one endpoint, one screen, one grant type. Its feature slug is
`device_grant`, evaluated as `entitlement.device-grant` through `ctx.flags` in the Worker.

## Context

### The user code is the only thing an attacker can guess

There are two codes with opposite constraints. The device code is machine-to-machine, so it is as
long as anything else the platform mints. The user code is read off a screen, sometimes aloud over
a phone, and typed with a remote control's on-screen keyboard, which bounds its length at about
eight characters whatever the security argument would prefer. It cannot carry enough entropy to
stand alone, and RFC 8628 section 5.1 says as much: the code space and the rate limit together are
what make guessing infeasible. Both are decided here, and neither is adjustable by a tenant.

### An alphabet chosen for reading aloud and typing on a remote

Twenty consonants, `BCDFGHJKLMNPQRSTVWXZ`, is the alphabet RFC 8628 section 6.1 suggests and the
right one for both jobs. Dropping the vowels means no code ever spells a word, which matters when
codes appear on a screen in a living room, and dropping every digit removes the confusions that
dominate misreadings — `0` against `O`, `1` against `I` and `L`, `5` against `S`, `2` against `Z` —
so a code dictated over a phone arrives as it left. Eight characters over twenty symbols is about
34.5 bits, or 25.6 billion codes.

### Approval happens somewhere the device cannot see

The person approving is on a different device from the one asking, and nothing ties the two
together except what the screen says. That is what makes the flow convenient and what makes it
phishable: an attacker can display their own user code and ask someone to approve it. The design
answers what it can — naming the client and the scopes, requiring an explicit approval, binding the
result to the approving session — and states the rest plainly.

## Decision

### The record

```sql
CREATE TABLE device_authorizations (
  id TEXT PRIMARY KEY,               -- devr_… TypeID
  device_code_hash TEXT NOT NULL UNIQUE,  -- SHA-256 of the device code, hex
  user_code TEXT NOT NULL,           -- folded: upper case, separators stripped
  client_id TEXT NOT NULL, scopes TEXT NOT NULL,
  interval_s INTEGER NOT NULL DEFAULT 5, last_polled_at INTEGER,
  expires_at INTEGER NOT NULL, approved_at INTEGER, denied_at INTEGER, redeemed_at INTEGER,
  subject_id TEXT, session_id TEXT, auth_time INTEGER, amr TEXT, token_family_id TEXT,
  created_at INTEGER NOT NULL);
CREATE UNIQUE INDEX device_user_code_pending ON device_authorizations (user_code)
  WHERE approved_at IS NULL AND denied_at IS NULL AND redeemed_at IS NULL;
```

The device code is `randomToken({ bytes: 32 })` from `@sdxc/crypto` and storage keeps its SHA-256,
found by that digest — the reasoning sessions use, since the value is 256 bits the platform
generated. The user code is drawn from the twenty-consonant alphabet by rejection sampling over
`randomBytes`, so every code is equally likely rather than biased by a modulo; it is displayed
`BCDF-GHJK`, and the folded form is what is stored and compared, so a person may retype it in lower
case with or without the hyphen.

Uniqueness holds only among codes still pending, which is what the partial index says and what the
product needs, since a code is meaningful for ten minutes. A collision comes back as a constraint
violation and the mint is retried, up to five times before the request fails: at 25.6 billion codes
against a pending set in the thousands that is a retry rather than a design problem, and it is
handled rather than assumed away.

### The verification URI and the QR code

`verification_uri` is `https://{tenant hostname}/device` — one path segment on a host the tenant
already owns, so a Pro or Premium tenant on a custom domain reads out `acme.example/device` and a
Free tenant reads out its platform subdomain. Short enough to say, short enough to type with a
remote. `verification_uri_complete` is that URL with `?user_code=BCDF-GHJK` per RFC 8628 section
3.3.2, which is what a QR code on the screen encodes; it prefills the field and still requires the
person to press approve, because the screen's value is that it names what is being approved.

### Polling

`/oauth/device_authorization` answers `device_code`, `user_code`, `verification_uri`,
`verification_uri_complete`, `expires_in` of 600 seconds and `interval` of 5. Ten minutes matches
the window an authorization request already gets, and it is the time a person has to pick up a
phone. The device then polls the token endpoint with
`grant_type=urn:ietf:params:oauth:grant-type:device_code`:

| Answer | When |
| --- | --- |
| `authorization_pending` | Nobody has decided yet |
| `slow_down` | The poll arrived inside the interval; the stored interval rises by 5 seconds |
| `access_denied` / `expired_token` | The person refused, or the request passed `expires_at` |
| Tokens | Approved, and this is the first redemption |

`slow_down` raising the stored interval makes it a control rather than advice: a device that
ignores it is answered `slow_down` again on a longer clock. Redemption is the single statement the
authorization code uses, `UPDATE … WHERE redeemed_at IS NULL … RETURNING *`, so two concurrent
polls cannot both mint tokens and a second redemption is `invalid_grant`.

### The approval screen

`/device` requires a session; without one the request enters the ordinary sign-in flow and returns
to the screen afterwards, so approving is always something an authenticated person did.

The screen renders the `ConsentScreen` shape *Consent and Scopes* defines, so a device approval and
a browser approval are one surface and one set of copy: the client's name and logo, the scopes
asked for, and the code being confirmed. The submitted form carries the interaction id rather than
the code, which keeps the flow state server-side.

Approval records `subject_id`, `session_id`, `auth_time` and `amr` from the approving session and
unions the agreed scopes into the grant, so tokens minted on the next poll carry those values and
`auth_time`, `amr` and `sid` mean here what they mean after a browser sign-in.

### Rate limiting

The code space is one half of RFC 8628 section 5.1 and this is the other, through
`@sdxc/rate-limit`:

| Budget | Limit | Keyed on |
| --- | --- | --- |
| Wrong user codes | 5 per 10 minutes | The approving session |
| Wrong user codes | 20 per hour | The connecting address |
| New device authorizations | 60 per minute | The client |
| Pending authorizations | 500 | The tenant |

Exhausting either wrong-code budget refuses `/device` for an hour. With a pending set in the
thousands against 25.6 billion codes a single guess lands with probability under one in ten
million, and twenty an hour is the whole of what one address gets.

### RPC methods

- `beginDeviceAuthorization({ clientId, scope, now })` — resolves the client, checks it carries the
  grant, validates the scope, mints both codes, and answers the RFC 8628 response.
- `beginDeviceApproval({ userCode, sessionId, now })` — spends an attempt against the code budget
  and resolves the pending row, answering `{ kind: "approve", screen } | { kind: "unknown" } |
  { kind: "expired" }`, so a wrong code costs a guess inside the call that looks it up.
- `decideDeviceApproval({ interactionId, sessionId, approved, now })` — binds the session, records
  the decision, unions the grant, and answers what the screen renders next.
- `redeemDeviceCode({ deviceCode, clientId, clientSecret, authScheme, now })` — enforces the
  interval and expiry, redeems once, mints, and answers the token endpoint's `TokenOutcome`.
- `sweepDeviceAuthorizations({ before, limit })` — bounded deletes from the scheduled handler.

### Discovery and the gate

While the entitlement holds, discovery advertises `device_authorization_endpoint` and adds the
grant URN to `grant_types_supported`. The gate is evaluated where the grant is written onto a
client, so a lapsed subscription stops a new client taking it while devices already in the field
keep signing in.

## Consequences

### Positive

- A person signs in on the device they already hold, with the credentials and second factor they
  already have, rather than typing a password with a remote control.
- The approval reuses the consent screen, and tokens carry the approving session's `auth_time` and
  `amr`, so a device-authorized token is as strong as the sign-in behind it.

### Negative

- The flow is phishable by construction: a person shown a code and a plausible reason can approve
  an attacker's device, and no screen copy closes that entirely.
- Eight characters is about 34.5 bits, so the rate limits are load-bearing and loosening them later
  loosens the grant's security directly; people behind one egress address also share a budget and
  can spend it on honest mistakes.

### Neutral

- Pending authorizations are capped per tenant, which bounds the table and makes a burst of device
  sign-ups visible rather than quietly expensive.

## Alternatives Considered

**A longer user code.** Six more characters would make the rate limit almost unnecessary. It also
makes the code unreadable over a phone and painful on a remote, which is the problem this grant
exists to solve. Rejected in favour of the alphabet and the limits.

**Approving straight from `verification_uri_complete` with no button.** One fewer step, and the QR
code becomes the whole flow. It also means a scanned code approves before the person has read what
they approved, which is the moment the flow's only defence operates. Rejected.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — whole operations, and single-statement redemption
- [ADR-011: Authorization Endpoint and PKCE](./ADR-011-authorization-endpoint-and-pkce.md) — the interaction record and the redemption statement reused here
- [ADR-012: Token Endpoint and Refresh Rotation](./ADR-012-token-endpoint-and-refresh-rotation.md) — the `TokenOutcome` shape and the endpoint this grant joins
- [ADR-015: Consent and Scopes](./ADR-015-consent-and-scopes.md) — the `ConsentScreen` the approval renders
- [ADR-019: Plan Catalog and Feature Split](./ADR-019-plan-catalog-and-feature-split.md) — the `device_grant` slug and its price
- [ADR-020: Entitlements as Feature Flags](./ADR-020-entitlements-as-feature-flags.md) — how the gate is evaluated
