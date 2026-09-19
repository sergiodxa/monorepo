# ADR-026: TOTP Second Factor and Recovery Codes

## Status

**Proposed** - 2026-09-18

## Background

A password is a secret that can be read over a shoulder, reused from another site, or typed into
a page that looks right and is not. A second factor is what makes that one secret insufficient on
its own. `@sdxc/crypto` ships the primitive — `totp.generateSecret`, `totp.code`, `totp.verify`
and `totp.uri`, RFC 6238 over the package's HMAC, every step in the drift window compared in
constant time — so this ADR decides the product around it: where the shared secret lives, what
proves an enrolment, what someone who loses the device does next, and when the factor is asked
for.

TOTP and its recovery codes are a base feature, on every tier including Free. Paywalling a second
factor sells a product whose default posture is the weaker one, and the tenants least able to
afford an upgrade are not the ones whose users deserve less. Tiers sell caps, retention and
configuration; the security floor is the same on all of them.

## Context

### A factor has to be independent of the recovery path

[ADR-006](./ADR-006-subjects-and-identifiers.md) makes the verified mailbox the proof of account
ownership, and it is the channel for address verification, password reset and magic-link sign-in.
A code delivered there is unlocked by the compromise that already unlocks the account: whoever
reads the mail resets the password and then reads the code they were sent. Sharing one boundary
with recovery makes it a second screen rather than a second factor. A generated code shares
nothing — the secret sits on a device and never travels. Phone numbers are not a factor here, nor
an identifier, nor a delivery channel: a code sent to a carrier belongs to whoever can move the
number, costs a message per attempt, and proves less than a mailbox already verified.

### A passkey is already both halves

[ADR-008](./ADR-008-passkeys.md) requires user verification on every ceremony, so an assertion
proves possession of a device and a biometric or PIN together, in one step, against an origin the
browser checked. TOTP is a shared secret typed into whatever page asks for it, so a real-time proxy
relays it. A passkey assertion is therefore complete alone; TOTP is the step added to credentials
that are phishable.

### Parameters are an interoperability decision

| Parameter | Value | Why it is this, and fixed |
| --- | --- | --- |
| Algorithm | SHA-1 | Every authenticator app implements it; strength rests on a 30-second window and a rate limit, not on collision resistance |
| Digits | 6 | What a person reads off a screen and retypes; the guessing budget is set by rate limiting |
| Period | 30 seconds | The step every app assumes when a QR code omits it |
| Drift window | 1 step either side | 90 seconds of acceptance, covering an unsynchronized phone clock |

A tenant changing any of these gains nothing an attacker notices and loses enrolments on whichever
app disagrees, so they carry no configuration.

## Decision

### Storage, and the secret at rest

Five tables in the tenant object: `totp_enrolments` (`enrolment_id`, `subject_id`,
`sealed_secret`, `expires_at`) for an enrolment awaiting proof; `totp_factors` (`subject_id`
primary key, `sealed_secret`, `label`, `activated_at`, `last_used_at`) for the active one, one per
subject, because a second authenticator is a second scan of the same QR code and a second row buys
only a longer list to clear at reset; `totp_claims` (`subject_id`, `code_hash`, `at`, unique on
the pair) as the replay guard; `recovery_codes` (`subject_id`, `code_hash`, `created_at`,
`used_at`); and `trusted_devices` (`id`, `subject_id`, `token_hash`, both clocks, and the address
and agent that made it). The secret is sealed with `seal` from `@sdxc/crypto` under an AES-GCM key
the object imports from a secret binding with `importKey`, so key material is never a column and a
storage export yields envelopes. Recovery codes are stored as the SHA-256 of the code and found by
that digest, on the reasoning the session token uses: the value is 80 bits the platform generated,
so a work factor would be paid on every attempt to slow a search that cannot be walked.

### Enrolment proves possession, and a code buys one attempt

`beginTotpEnrolment` mints the secret, seals it into `totp_enrolments`, and returns the
`otpauth://` URI and the base32 setup key once. The secret crosses the boundary because handing it
to an authenticator app is the point of the operation; nothing afterwards returns it, and
`describeSubject` reports that a factor exists and when it was last used, never what it is.
`activateTotpFactor` spends the enrolment row, verifies a code read off the app, and only then
writes `totp_factors` — so an unproved enrolment never becomes a factor, and a wrong clock is a
failed setup rather than a lockout. It mints the recovery set in the same call.

The drift window accepts a code for 90 seconds, long enough for an observed one to be replayed.
Before checking anything, a verifying method inserts the submission's digest into `totp_claims`;
the unique index makes a second insert of that digest a conflict, refused as a replay. Taking the
claim ahead of the verification keeps the mutual exclusion in one statement, with no
read-modify-write spanning the `await` that derives the code, and it costs an attacker a distinct
guess per attempt. Claims past the window are deleted when the next is taken.

### When the factor is demanded, and when it is remembered

| Situation | Second factor |
| --- | --- |
| Password or magic-link sign-in, subject has a factor | Demanded |
| Passkey assertion | Satisfied by the assertion; `amr` carries `webauthn` |
| Tenant policy `required`, subject has no factor | Enrolment before the sign-in completes |
| Enrolling or removing a factor, regenerating codes, changing a password, `prompt=login`, an exceeded `max_age` | Demanded, and a remembered device does not satisfy it |
| Same browser within 30 days, holding a valid trusted-device token | Satisfied |

Remembering is a `trusted_devices` row and a `__Host-` cookie carrying a token whose SHA-256 is
the stored value, bound to one subject so a shared machine remembers each account separately. The
rows are listed and revocable on the account screen, and every one for a subject is dropped when
the factor changes, when a password is reset, and on an administrator reset. The tenant setting is
`optional` or `required` — a factor policy, available on every tier. An accepted factor adds `otp`
to the `amr` on the session row that already exists.

### Recovery codes, and what happens when they run out

Ten codes at activation, each 80 bits from `randomBytes(10)` in the unpadded uppercase base32
alphabet, shown in four groups of four; comparison strips separators and folds case, so what a
person retypes matches what they wrote down. Each is single use, stamped `used_at` and never
accepted again, and regeneration replaces the whole set, because a half-old set is one nobody
knows the state of. The remaining count travels on every sign-in result, the screen asks for
regeneration below three, and the verified mailbox is told when the last is spent. A subject with
no codes and no authenticator has one path left, the administrator reset below: a code issued by
support would turn a support conversation into a credential for any subject.

### Administrator reset, and what it costs

`resetSecondFactor` removes the factor, every recovery code and every trusted device, revokes
every session, marks re-enrolment required at the next sign-in, and returns the address to notify.
It is necessary — people lose phones — and it is the move an attacker makes after compromising an
administrator. The design answers that where it can: an audit row names the actor and the reason,
the subject is mailed unconditionally, and the dashboard roles that can invoke it are held to a
second factor themselves. What remains is stated plainly: an administrator of a tenant can take
over any subject in it, and the record of it is the control.

### RPC methods

- `beginTotpEnrolment({ subjectId })` — mints, seals, stores, answers `{ enrolmentId, uri,
  setupKey }`.
- `activateTotpFactor({ enrolmentId, code, label })` — spends the enrolment, verifies, activates,
  mints recovery codes when there are none, and answers them or a discriminated union naming the
  refusal.
- `completeSecondFactor({ sessionId, submission, trustDevice, agent })` — claims the submission,
  accepts it as a code or as a recovery code, stamps the factor or spends the code, extends the
  session's `amr`, mints a trusted-device token when asked, and answers the remaining recovery
  count. One operation for one screen, whichever the person typed.
- `regenerateRecoveryCodes({ subjectId })` — replaces the set and answers it once.
- `removeTotpFactor({ subjectId, submission })` — requires a current code or a recovery code, and
  refuses under a `required` policy.
- `resetSecondFactor({ subjectId, actor, reason })` — the administrator path above;
  `revokeTrustedDevice({ subjectId, deviceId })` drops one browser.

Reading state adds no method: `describeSubject` gains the factor's label, last use, remaining
recovery count and trusted devices.

## Consequences

### Positive

- The factor is independent of the mailbox, so a compromised mailbox recovers a password and
  still produces no code, on every tier.
- Replay inside the drift window is closed by a unique index rather than by ordering statements
  correctly around an `await`.
- A secret at rest is an AES-GCM envelope, so a leaked copy of a tenant's storage is not a set of
  working authenticators.

### Negative

- An administrator can strip a subject's factor, which makes the administrator account the
  weakest link in a tenant that enables the feature at all.
- Recovery codes on paper are a secret the platform cannot revoke when the paper is lost rather
  than destroyed, and regeneration is something the subject has to remember to do.
- TOTP is phishable by a real-time proxy, so it raises the cost of an attack without ending the
  class, and one factor per subject makes a lost device a reset even for someone who scanned the
  code onto a second phone.

### Neutral

- A badly wrong device clock fails enrolment naming clock drift, and claims and trusted devices
  are tables with expiry that join the object's scheduled sweep.

## Alternatives Considered

**An emailed code as a second factor.** Universally understood, needs no app, enrols in one step.
It is unlocked by the mailbox that already recovers the account, so it adds a screen and no
boundary, and puts a mail provider and a per-message cost on the sign-in path. Rejected.

**A work factor over recovery codes.** Treats them as passwords, which is the conservative
instinct. They are 80 bits the platform generated, so the derivation slows a search nobody can run
and spends deliberate CPU on a single-threaded object at every attempt. Rejected for a digest
lookup.

**Support-issued one-time recovery.** Removes the dead end for a subject with no codes and no
device, and makes a support conversation a credential for any account. Rejected; the administrator
reset is the path, audited and announced.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md)
- [ADR-006: Subjects and Identifiers](./ADR-006-subjects-and-identifiers.md)
- [ADR-007: Password Credentials](./ADR-007-password-credentials.md)
- [ADR-008: Passkeys](./ADR-008-passkeys.md)
- [ADR-009: Sessions](./ADR-009-sessions.md) — the `amr` a factor extends
- [ADR-035: Attack Protection](./ADR-035-attack-protection.md) — the budget a code submission spends
- [root ADR-023: Web Crypto Primitives Package](../ADR-023-web-crypto-primitives-package.md)
