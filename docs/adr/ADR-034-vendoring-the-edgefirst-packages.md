# ADR-034: Vendoring the `@edgefirst-dev` Packages

## Status

**In Progress** - 2026-08-16

## Background

Four dependencies in this monorepo come from `@edgefirst-dev`, published from outside it: `jwt`, `api-client`, `r2-file-storage`, and `server-timing`. They are not third-party in the usual sense — they are the same author's code, released separately and then consumed here through a registry.

That arrangement costs something at every edit. A change to one of them is a release, a version bump, and an install before it can be used, and the code cannot be read next to the code that calls it. It also hides a fifth package: `@edgefirst-dev/jwt` depends on `@edgefirst-dev/data`, which arrives here transitively and is load-bearing — every JWT subclass in this repo reads its claims through that package's `ObjectParser`.

## Context

| Package           | Consumers | Own dependencies                                      | Surface actually used               |
| ----------------- | --------- | ----------------------------------------------------- | ----------------------------------- |
| `jwt`             | 5         | `jose`, `data`, `type-fest`, `@mjackson/file-storage` | Nearly all of it                    |
| `api-client`      | 1         | none                                                  | Constructor, `get`, `post`          |
| `r2-file-storage` | 1         | none                                                  | None — only ever passed onward      |
| `server-timing`   | 1         | none                                                  | Constructor, `measure`, `toHeaders` |

The three small packages are a few hundred lines between them. `jwt` is the substantial one at roughly 600 lines, and it is also the only one whose surface is genuinely exercised.

`r2-file-storage` is the odd case: its consumer constructs an instance and never calls a method on it. The object exists only to be handed to `JWK.signingKeys()`, under a `@ts-expect-error` caused by a stale `@cloudflare/workers-types` peer. Nothing here needs the package; something here needs to satisfy an interface it happens to implement.

## Decision

Bring three of the four into the monorepo as `@pkg/*` packages, and delete the fourth.

**`@pkg/api-client`** and **`@pkg/server-timing`** are straight ports, trimmed to what is used. The api-client drops its interceptor registry, which duplicated the `before`/`after` hooks it also has, and its injectable `fetch` option, which the house rules forbid. The server-timing package drops an unused `measure` overload that was the only thing in it that could fail, which leaves it with no error type and no dependencies.

**`@pkg/jwt`** is a faithful port that keeps `jose` as an internal dependency. It is not reimplemented on WebCrypto. `@edgefirst-dev/data` is replaced by an internal parser covering the five methods this repo actually calls.

**`@edgefirst-dev/r2-file-storage` is deleted rather than ported.** `JWK.signingKeys()` declares the narrow interface it needs, and the caller passes something that satisfies it. A package is not the right unit for an interface with one implementation and no calls.

### Reversals

This decision reverses two earlier ones, both for reasons that no longer apply:

- [ADR-001](./ADR-001-new-package-extraction.md) Phase 6 cancelled `@pkg/server-timing` because "server timing is already from remix-utils, not a custom implementation" and the blog "just wraps it with context storage". Neither is true now: the consumer is `apps/r3-auth`, and what it wraps is an `@edgefirst-dev` package, not remix-utils.
- [ADR-023](./ADR-023-web-crypto-primitives-package.md) recorded that "JWT stays out of scope — the existing JWT dependency remains; this package provides primitives, not token formats". That still holds as written: `@pkg/crypto` provides primitives and `@pkg/jwt` provides the token format. What changes is only where the JWT dependency lives.

## Consequences

### Positive

- **A change to any of them is an edit, not a release** - the code is read and changed beside its callers.
- **The transitive fifth package disappears** - `@edgefirst-dev/data` arrived without being asked for and is replaced by an internal module covering what is used.
- **Dead surface stops being carried** - interceptors, an unused overload, and an entire package that was never called are gone rather than vendored.
- **A stale `@ts-expect-error` resolves** - narrowing the storage interface removes the type mismatch it was suppressing.

### Negative

- **`jose` remains, relocated** - it moves from a transitive dependency of `@edgefirst-dev/jwt` to a direct dependency of `@pkg/jwt`. The dependency list is shorter but not free of third-party crypto.
- **Maintenance moves here** - upstream fixes no longer arrive by version bump.
- **The parser throws** - the internal parser keeps its throwing behavior instead of returning `Result`, because it is consumed inside property getters in eight JWT subclasses. This is a deliberate deviation from the house convention, marked as such where it lives.

### Neutral

- **The public API is preserved** - consumers change their import specifier and nothing else.
- **`@pkg/api-client` has one consumer** - as did the package it replaces. It is a base class, so the alternative was inlining it into that consumer.

## Notes

- Reimplementing `@pkg/jwt` on `@pkg/crypto` and WebCrypto was considered and deferred, not rejected. It is feasible: WebCrypto's ECDSA emits raw `r||s`, which is already the JWS ES256 wire format, so the DER conversion that usually makes this painful is not needed. The work is roughly 500 lines, most of the risk sitting in `createRemoteJWKSet`'s caching and `kid` matching. Vendoring first freezes the API behind our own package and builds the test suite that a later rewrite would need as its safety net.
- `docs/adr/r3-auth/ADR-001-port-auth-to-remix-v3.md:554` lists `@edgefirst-dev/server-timing` under "Keep (not replaceable)", which this decision makes stale.
- `JWT.verify` is read two ways across the repo: as returning `{ payload }` in one place, and as returning an instance with claim getters everywhere else. A `Proxy` in the constructor makes both work. The port preserves it; it is worth unifying separately.
