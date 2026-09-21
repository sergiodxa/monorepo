# ADR-008: Passkeys

## Status

**Proposed** - 2026-09-18

## Background

A passkey proves possession of a private key that never leaves the device, bound to one relying
party and unlocked by a biometric or a PIN. It is phishing-resistant by construction, and it ships
here as a peer of the password rather than as an upgrade offered later.

`@sdxc/passkey` implements both halves: a `RelyingParty` that issues and verifies the two
ceremonies, and a `Passkey` browser client that runs them. This ADR decides how a multi-tenant
provider uses it — which relying party id a tenant's credentials bind to, where challenges live,
and what the tenant object exposes.

Passkeys are a base feature, available on every tier including Free. A security factor sold as an
upgrade is one most tenants will not buy, leaving the weaker credential as the default.

## Context

### A credential is bound to a relying party id, and that binding is permanent

The relying party id is written into the credential at registration and can never be changed
afterwards. A ceremony may only assert an id that is a registrable suffix of the origin running
it, so the id a tenant's passkeys are bound to decides, for the life of those credentials, which
origins can spend them.

Custom domains are a Pro and Premium feature, which means a tenant's hostname changes at least
once: on upgrade, and again whenever it moves its login page elsewhere. Binding credentials to the
rented domain strands every passkey the tenant's users hold the day that domain changes.

| Relying party id                | Isolation between tenants                                    | Survives a domain change         |
| ------------------------------- | ------------------------------------------------------------ | -------------------------------- |
| One platform-wide domain        | None: one tenant's credentials are offered on another's page | Yes                              |
| The tenant's platform subdomain | Per tenant                                                   | Yes                              |
| The tenant's custom domain      | Per tenant                                                   | No: every credential is stranded |

### Discoverable credentials remove the identifier field

Calling `rp.authenticate()` with no `allow` starts a usernameless ceremony: the browser offers
every discoverable credential it holds for the relying party id, and the assertion carries the
user handle naming the account. That handle is readable on the device, so it is the opaque subject
id and never an address.

### One passkey covers one device

A credential lives on the authenticator that created it, so a subject signing in from a phone, a
laptop and a hardware key holds three, each primary in its own right. Several at once is what
makes a passkey usable everywhere the subject already is, and a lost device a row to revoke.

### The signature counter is a clone signal, not a session counter

`verifyAuthentication` returns the counter to store and refuses an assertion whose counter fails
to advance past a non-zero stored value. Most synced passkeys keep no counter and report zero
forever, so zero on both sides is normal and only a regression from a non-zero value means
anything.

## Decision

### The relying party id is the tenant's platform subdomain, for good

Every tenant gets `<tenant>.<platform domain>` at creation, and that host is its relying party id
permanently, whatever hostname it later serves its sign-in page on. It is per tenant, so one
tenant's credential picker never lists another's, and it belongs to the platform, so no credential
depends on a domain registration the tenant can let lapse.

A tenant on a custom domain keeps that id and runs the ceremony from its own origin, which the
Worker enables by serving a `/.well-known/webauthn` document on the platform origin listing the
custom origin as a related origin. The tenant object builds its `RelyingParty` with `id` set to
the platform subdomain and `origin` set to both, so an assertion from either is accepted and one
from anywhere else is an `OriginMismatchError`; `allowFramed` stays off, so an embedded frame
cannot spend a tenant's credentials.

A browser that does not support related origins falls back to the sign-in methods that do not
depend on one — password and magic link — rather than to a ceremony that would fail after the
prompt has already been shown.

### Ceremony policy

`userVerification: "required"` on both ceremonies, so an assertion proves possession and a
biometric or PIN together, which is what lets one gesture stand as a primary credential.
`residentKey: "required"`, so every enrolled credential is discoverable and the usernameless path
always works. Attestation stays as the package sends it: none is requested, statements carrying a
certificate chain are refused, and what makes an enrollment trustworthy is that the subject was
already authenticated when it ran.

### Tables

`passkeys` — `credential_id` (primary key), `subject_id`, `public_key`, `algorithm`, `counter`,
`transports`, `aaguid`, `label`, `syncable`, `backed_up`, `created_at`, `last_used_at`.

`passkey_challenges` — `ceremony_id`, `kind` (`registration` or `authentication`), `subject_id`
when the ceremony belongs to one, `challenge`, `expires_at`. `rp.register()` and
`rp.authenticate()` hand back a challenge the matching verify call needs again, and this row holds
it: the verify method deletes it before doing anything else, so one challenge buys exactly one
ceremony and a replayed assertion finds nothing to verify against. The Worker parks the
`ceremony_id` in the sign-in cookie, where it names a row and authorizes nothing, since the
assertion still has to verify. Expiry matches the prompt timeout and a sweep clears the rest.

### RPC methods

- `beginPasskeyRegistration({ subjectId })` — builds the options with `user.id` set to the subject
  id, `user.name` set to the primary identifier, and `exclude` set to the subject's existing
  credential ids. Stores the challenge, returns `{ ceremonyId, options }`.
- `enrolPasskey({ ceremonyId, response, label, agent })` — spends the challenge, runs
  `rp.verifyRegistration`, stores the credential under the given label or the default derived from
  `agent`, and returns the row's public fields. A refusal comes back as a discriminated union
  carrying the error name, never the error.
- `beginPasskeyAuthentication({})` — a ceremony with no `allow`, so the page asks for no identifier.
- `signInWithPasskey({ ceremonyId, response, agent })` — spends the challenge, resolves the
  credential by the id the assertion reports, runs `rp.verifyAuthentication`, records the counter and
  `last_used_at`, and opens the session in the same call, returning the subject and the
  authentication methods used. A counter regression is answered here too: the assertion is denied,
  the credential is suspended, and the reason comes back so the Worker can ask for a re-enrollment.
- `renamePasskey({ subjectId, credentialId, label })`.
- `revokePasskey({ subjectId, credentialId })` — applies the shared remaining-credential
  predicate before removing the row.

### A subject holds many passkeys at once

Every credential stands on its own: adding a laptop takes nothing from the phone, and the
credential list names the devices that can sign in. That is what `beginPasskeyRegistration` passes
`exclude` for — a device already holding one for this subject is refused by the browser before the
prompt appears, so enrolment adds a device rather than duplicating one. Revoking removes a device
and leaves the rest; the one revocation refused is the last credential, since `revokePasskey` asks
the remaining-credential predicate the credential ADRs share — one count across passwords,
passkeys, linked identities and verified addresses, as ADR-007's `removePassword` does.

### A new passkey is labelled for the device that enrolled it

`enrolPasskey` reads the enrolling request's `User-Agent` and writes a readable device name —
"Chrome on Windows", "iPhone" — as the credential's default label, because the list a subject
revokes from is one they have to recognize a credential in, and four rows reading `Passkey` is a
list nobody can act on safely. A `User-Agent` is self-reported, so the label is a hint the subject
corrects with `renamePasskey` rather than a fact, and nothing about the credential's standing
reads it. An absent or unrecognized header falls back to the model the AAGUID names, and to
`Passkey` when that is unknown. `describeSubject` returns each label with its model and last use.

### The sign-in page

The hosted page renders an identifier field marked `autocomplete="username webauthn"` beside a
client island that checks `Passkey.isAutofillSupported()` and, when it passes, starts
`Passkey.autofill` at hydration, so the prompt waits inside the autocomplete menu and resolves
only if somebody picks a credential. The explicit passkey button runs `Passkey.authenticate`,
taking over the browser's single ceremony slot; leaving the step calls `Passkey.cancel()` to
release it. A browser without WebAuthn gets `UnsupportedError` and the password form.

## Consequences

### Positive

- A tenant can move its login page between domains and every enrolled passkey keeps working,
  because nothing binds to a hostname the tenant rents.
- One tenant's credentials are never offered on another tenant's sign-in page.
- A challenge is single-use by construction: the read and the delete happen inside one object
  method, with no interleaving point between them.
- Private key material never reaches the platform, so a tenant's passkeys survive a breach of
  everything it stores.

### Negative

- The relying party id is a platform hostname, so the prompt names the platform's domain rather
  than the tenant's brand even for a tenant paying for a custom domain.
- Related origins are recent, so a tenant on a custom domain has visitors for whom passkey sign-in
  is unavailable and the fallback path carries real traffic.
- `residentKey: "required"` costs a slot on security keys with a small fixed number of them, and
  `userVerification: "required"` excludes authenticators with no PIN or biometric.

### Neutral

- `syncable` and `backed_up` are recorded as risk signals a later attack-protection ADR can read,
  and gate nothing on their own.
- Restricting enrollment to named authenticator models is outside what this platform offers, since
  attestation carrying a certificate chain is refused.

## Alternatives Considered

**One platform-wide relying party id.** The simplest answer, and one credential then works across
every tenant. It also has the browser offer one tenant's credentials on another's sign-in page,
leaking that an account exists at both. Rejected: the product is tenant isolation.

**The tenant's custom domain as the relying party id.** The prompt then names the tenant's own
brand, which is what a customer paying for a custom domain is buying. Every credential is stranded
the day the domain changes, and the recovery is a mass re-enrollment the tenant's users experience
as a lockout. Rejected.

**Passkeys as a second factor over a password.** The conventional rollout, and it keeps the
password as the account's root — which keeps the phishable credential as the one that matters.
Rejected: a passkey is primary here, and a subject may have no password at all.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md)
- [ADR-005: Hostname Resolution and Tenant Domains](./ADR-005-hostname-resolution-and-tenant-domains.md)
- [ADR-006: Subjects and Identifiers](./ADR-006-subjects-and-identifiers.md)
- [ADR-007: Password Credentials](./ADR-007-password-credentials.md)
- [ADR-036: Account Linking](./ADR-036-account-linking.md) — where the remaining-credential predicate lives
- [`@sdxc/passkey` README](/packages/passkey/README.md)
