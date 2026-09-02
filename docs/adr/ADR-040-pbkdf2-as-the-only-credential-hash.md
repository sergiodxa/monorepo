# ADR-040: PBKDF2 as the Only Credential Hash

## Status

**Implemented** - 2026-09-02

## Background

`@pkg/oidc-provider` hashes the two credentials it stores at rest: subject passwords
and OAuth client secrets. It was written against bcrypt, then moved to PBKDF2-HMAC-SHA256
through `@pkg/crypto`, and kept `bcryptjs` alongside it so a hash written under the older
scheme would still verify and be replaced on the next successful check.

A dependency review asked whether `bcryptjs` was still earning its place. Reading the
code alone says yes — `verifySecret` imports it and routes to it on a parse failure — and
that reading is what makes the compatibility path look permanent. It is not: the package
has never served production traffic, so no stored hash has ever been written in the older
format.

## Context

The provider is consumed by `apps/auth-saas`, which is not deployed. Every hash the
provider has ever written came from `@pkg/crypto`'s `password.hash`, in the
self-describing `$pbkdf2-sha256$i=...$<salt>$<key>` format.

The bcrypt branch was reachable in exactly two situations:

1. A stored hash in bcrypt format — which no database holds.
2. A stored value that parses as neither format, where `bcrypt.compare` throws and the
   `catch` reports a mismatch.

Only the second was doing any work, and it was doing it incidentally: the fail-closed
behavior for an unreadable stored hash was a side effect of a comparison against a
library that could not read it either.

Keeping the branch carried a real cost. `bcryptjs` is a full password-hashing
implementation held for a case that cannot occur, and its presence in the source is
itself the argument for keeping it — the next reader sees a migration path and infers a
migration.

## Decision

`@pkg/oidc-provider` hashes and verifies credentials through `@pkg/crypto` alone.
`bcryptjs` is removed, and MUST NOT return.

The fail-closed behavior becomes explicit rather than incidental. `verifySecret`
classifies a `MalformedHashError` or an `UnsupportedAlgorithmError` as an unreadable
stored value and reports `matches: false`, so a corrupt row denies access rather than
reaching the caller as a failure it would have to interpret. Every other failure
propagates.

Upgrade-on-verify stays, because it still has a job: `password.needsRehash` reports a
hash whose iteration count, salt length or key length trails current policy, and raising
the policy leaves existing hashes behind. `Credential.verify` and `Secret.verify` write
the replacement in the request that accepted the plaintext.

Tests build an under-policy hash directly — `underpoweredHash` in
`src/shared/test/hashes.ts` derives at a low iteration count — so the upgrade path keeps
its coverage without a second hashing library.

## Consequences

### Positive

- One hashing implementation in the package, so there is one answer to how a credential
  is stored.
- The fail-closed path is stated in the code that implements it, and is covered by tests
  that name it.
- The upgrade path is tested against the condition that can actually occur, a cost below
  policy, rather than a format that cannot.

### Negative

- Should a database with bcrypt hashes ever appear, those rows would fail closed and the
  credential would have to be reset. This is the intended trade: it is a reset, not a
  silent acceptance.

### Neutral

- `@pkg/crypto` continues to report a bcrypt hash as a `MalformedHashError`. That is its
  own parsing contract and is unaffected by this decision.

## Alternatives Considered

**Keep `bcryptjs` for the unreadable-hash case.** The fail-closed behavior is worth
keeping, but a password-hashing library is not the way to express it. Two lines of
classification say the same thing and say it on purpose.

**Keep `bcryptjs` in case the provider is deployed against an existing database.** No
such database exists, and the provider's schema is created by its own migrations. A
compatibility path held against a hypothetical import is a path nothing can retire.

## References

- [`@pkg/oidc-provider` README](/packages/oidc-provider/README.md) - the upgrade pattern
- [ADR-011](./ADR-011-oidc-provider-engine-package.md) - the provider package
- [ADR-023](./ADR-023-web-crypto-primitives-package.md) - `@pkg/crypto`
