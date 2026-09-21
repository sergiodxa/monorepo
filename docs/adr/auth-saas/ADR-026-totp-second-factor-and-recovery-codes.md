# ADR-026: TOTP Second Factor and Recovery Codes

## Status

**Proposed** - 2026-09-18

## Background

A password is a secret that can be read over a shoulder, reused from another site, or typed into a
page that looks right and is not, and a second factor is what makes it insufficient on its own.
`@sdxc/crypto` ships the primitive — `totp.generateSecret`, `totp.verify` and `totp.uri`, RFC 6238
over the package's HMAC, compared in constant time across the drift window — so this ADR decides
the product around it: where the secret lives, what proves an enrolment, what a lost device costs,
when the factor is asked for, and what a completed check proves to a relying party.

TOTP and its recovery codes are a base feature, on every tier including Free. Paywalling a second
factor sells a product whose default posture is the weaker one; tiers sell caps, retention and
configuration, and the security floor is the same on all of them.

## Context

### A factor has to be independent of the recovery path

[ADR-006](./ADR-006-subjects-and-identifiers.md) makes the verified mailbox the proof of account
ownership, and it is the channel for address verification, password reset and magic-link sign-in.
A code delivered there is unlocked by the compromise that already unlocks the account: whoever
reads the mail resets the password and then reads the code they were sent, which makes it a second
screen rather than a second factor. A generated code shares nothing: the secret sits on a device
and never travels. Phone numbers are not a factor here, nor an identifier, nor a delivery channel:
a code sent to a carrier belongs to whoever can move the number, costs a message per attempt, and
proves less than a mailbox already verified.

### A passkey is already both halves

[ADR-008](./ADR-008-passkeys.md) requires user verification on every ceremony, so an assertion
proves a device and a biometric or PIN together, against an origin the browser checked. TOTP is a
shared secret typed into whatever page asks for it, so a real-time proxy relays it. A passkey
assertion is therefore complete alone; TOTP is the step added to credentials that are phishable,
and a subject whose only credential is a passkey satisfies a later demand by asserting it again.

### Parameters are an interoperability decision

| Parameter    | Value              | Why it is this, and fixed                                                                                                 |
| ------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Algorithm    | SHA-1              | Every authenticator app implements it; strength rests on a 30-second window and a rate limit, not on collision resistance |
| Digits       | 6                  | What a person reads off a screen and retypes; the guessing budget is set by rate limiting                                 |
| Period       | 30 seconds         | The step every app assumes when a QR code omits it                                                                        |
| Drift window | 1 step either side | 90 seconds of acceptance, covering an unsynchronized phone clock                                                          |

A tenant changing any of these gains nothing an attacker notices and loses enrolments on whichever
app disagrees, so they carry no configuration.

## Decision

### Storage, and the secret at rest

Five tables in the tenant object: `totp_enrolments` (`enrolment_id`, `subject_id`,
`sealed_secret`, `expires_at`) for an enrolment awaiting proof; `totp_factors` (`subject_id`
primary key, `sealed_secret`, `label`, `activated_at`, `last_used_at`) for the active one, one per
subject, because a second authenticator is a second scan of the same QR code; `totp_claims`
(`subject_id`, `code_hash`, `at`, unique on the pair) as the replay guard; `recovery_codes`
(`subject_id`, `code_hash`, `created_at`, `used_at`); and `trusted_devices` (`id`, `subject_id`,
`token_hash`, both clocks, and the address and agent that made it). The secret is sealed with
`seal` from `@sdxc/crypto` under an AES-GCM key the object imports from a secret binding with
`importKey`, so key material is never a column. Recovery codes are stored as the SHA-256 of the
code and found by that digest, on the reasoning the session token uses.

### Enrolment proves possession, and a code buys one attempt

`beginTotpEnrolment` mints the secret, seals it into `totp_enrolments`, and returns the
`otpauth://` URI and the base32 setup key once. The secret crosses the boundary because handing it
to an authenticator app is the point of the operation, and nothing afterwards returns it.
`activateTotpFactor` spends the enrolment row, verifies a code read off the app, and only then
writes `totp_factors` — so an unproved enrolment never becomes a factor, and a wrong clock is a
failed setup rather than a lockout.

The drift window accepts a code for 90 seconds, long enough for an observed one to be replayed.
Before checking anything, a verifying method inserts the submission's digest into `totp_claims`;
the unique index makes a second insert of that digest a conflict, refused as a replay. Claiming
ahead of verifying keeps the mutual exclusion in one statement, with no read-modify-write spanning
the `await` that derives the code, and claims past the window are deleted when the next is taken.

### When the factor is demanded, and when it is remembered

| Situation                                                                                                                              | Second factor                                         |
| -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Password or magic-link sign-in, subject has a factor                                                                                   | Demanded                                              |
| Passkey assertion                                                                                                                      | Satisfied by the assertion; `amr` carries `webauthn`  |
| Tenant policy `required`, subject has no factor                                                                                        | Enrolment before the sign-in completes                |
| Enrolling or removing a factor, regenerating codes, changing a password, `prompt=login`, an exceeded `max_age`, an `acr_values` demand | Demanded, and a remembered device does not satisfy it |
| Same browser within 30 days, holding a valid trusted-device token                                                                      | Satisfied                                             |

Remembering is a `trusted_devices` row and a `__Host-` cookie carrying a token whose SHA-256 is
the stored value, bound to one subject, so a shared machine remembers each account separately. The
rows are listed and revocable on the account screen, and all of a subject's are dropped when the
factor changes, on a password reset, and on an administrator reset. The tenant setting is
`optional` or `required` — a factor policy, available on every tier.

### Step-up for one action

A relying party that wants the factor for one action — approving a payment, deleting an account —
sends the browser to `/authorize` with `acr_values` naming `mfa`, the one value discovery
advertises. _Authorization Endpoint and PKCE_ reads it as a requirement beside the `prompt` and
`max_age` it already handles, its outcome union gaining a `step-up` kind carrying the interaction
id and the screen. A subject with no factor is offered enrolment; leaving without enrolling, like
any `prompt=none` request, redirects with `unmet_authentication_requirements`.

The screen is `/u/step-up`, a row in the set _Hosted Sign-In UI and Branding_ owns, under its
branding and no-JavaScript constraints. Carrying the interaction id alone, it leaves the object to
read the verified `redirect_uri` off the stored request and build the `Location`, and the
submission is claimed against that interaction as well as the subject, so a code is spent once,
there only. Completion moves `auth_time` to the verified instant, adds `otp` or `webauthn` to
`amr` and mints `acr` as `mfa`, telling a check made moments ago from a session holding a factor
since morning. The answer stands fifteen minutes; `max_age` beside `acr_values` narrows it.

### Recovery codes, and what happens when they run out

Ten codes at activation, each 80 bits from `randomBytes(10)` in the unpadded uppercase base32
alphabet, shown in groups of four; comparison strips separators and folds case. Each is single
use, stamped `used_at` and never accepted again, and regeneration replaces the whole set, because
a half-old set is one nobody knows the state of. The remaining count travels on every sign-in
result, the screen asks for regeneration below three, and the mailbox hears when the last is
spent. A subject with no codes and no authenticator has one path, the administrator reset below.

### Administrator reset, and what it costs

`resetSecondFactor` removes the factor, every recovery code and every trusted device, revokes
every session, marks re-enrolment required at next sign-in, and returns the address to notify. It
is what someone who lost a phone needs, and the move an attacker makes after compromising an
administrator. An audit row names the actor and the reason, the subject is mailed unconditionally,
and the roles that can invoke it are held to a second factor themselves.

### RPC methods

- `beginTotpEnrolment({ subjectId })` — mints and seals, answers `{ enrolmentId, uri, setupKey }`.
- `activateTotpFactor({ enrolmentId, code, label })` — spends the enrolment, verifies, activates,
  mints the recovery set, and answers it or a union naming the refusal.
- `completeSecondFactor({ sessionId, submission, trustDevice, agent })` — claims the submission,
  accepts a code or a recovery code, extends the session's `amr`, mints a trusted-device token
  when asked, and answers the remaining count.
- `completeStepUp({ interactionId, sessionId, submission, now })` — claims the submission against
  the interaction, accepts a code, a recovery code or an assertion, moves `auth_time`, extends
  `amr`, and answers the authorization outcome, so one call yields one redirect.
- `regenerateRecoveryCodes({ subjectId })` — replaces the set and answers it once.
- `removeTotpFactor({ subjectId, submission })` — requires a current code or a recovery code, and
  refuses under a `required` policy.
- `resetSecondFactor({ subjectId, actor, reason })` — the administrator path above;
  `revokeTrustedDevice({ subjectId, deviceId })` drops one browser.

Reading state adds no method: `describeSubject` gains the label, last use, code count and devices.

## Consequences

### Positive

- The factor is independent of the mailbox: a compromised mailbox recovers a password, not a code.
- Replay inside the drift window is closed by a unique index, not by ordering around an `await`.
- A secret at rest is an AES-GCM envelope, so leaked storage is not a set of live authenticators.

### Negative

- An administrator can strip a subject's factor, which makes the administrator account the weakest
  link in a tenant that enables the feature at all.
- Recovery codes on paper are a secret nobody can revoke when the paper is lost, not destroyed.
- TOTP is phishable by a real-time proxy, so it raises the cost of an attack without ending the
  class, and one factor per subject makes a lost device a reset.
- A step-up is a redirect out of the application and back, costing the page the person was on.

### Neutral

- A badly wrong device clock fails enrolment naming clock drift, and claims and trusted devices
  are tables with expiry that join the object's scheduled sweep.

## Alternatives Considered

**An emailed code as a second factor.** Universally understood and needs no app. It is unlocked by
the mailbox that already recovers the account, so it adds a screen and no boundary, and puts a
mail provider and a per-message cost on the sign-in path. Rejected.

**A work factor over recovery codes.** Treats them as passwords. They are 80 bits the platform
generated, so the derivation slows a search nobody can run and spends deliberate CPU on a
single-threaded object at every attempt. Rejected for a digest lookup.

**Support-issued one-time recovery.** Removes the dead end for a subject with no codes and no
device, and makes a support conversation a credential for any account. Rejected; the administrator
reset is the path, audited and announced.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md)
- [ADR-006: Subjects and Identifiers](./ADR-006-subjects-and-identifiers.md)
- [ADR-007: Password Credentials](./ADR-007-password-credentials.md)
- [ADR-008: Passkeys](./ADR-008-passkeys.md)
- [ADR-009: Sessions](./ADR-009-sessions.md) — the `amr` and `auth_time` a factor moves
- [ADR-010: Signing Keys and Token Minting](./ADR-010-signing-keys-and-token-minting.md) — mints the `acr` a step-up sets
- [ADR-011: Authorization Endpoint and PKCE](./ADR-011-authorization-endpoint-and-pkce.md) — carries the demand and resumes the request
- [ADR-016: Hosted Sign-In UI and Branding](./ADR-016-hosted-sign-in-ui-and-branding.md) — owns the screen set the step-up page joins
- [ADR-035: Attack Protection](./ADR-035-attack-protection.md) — the budget a code submission spends
- [root ADR-023: Web Crypto Primitives Package](../ADR-023-web-crypto-primitives-package.md)
