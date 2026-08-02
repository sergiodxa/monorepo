# ADR-023: Web Crypto Primitives Package

## Status

**Accepted** - 2026-07-29

## Background

Cryptographic code is scattered across apps and packages as one-off `crypto.subtle` calls: an API key hasher here, an HMAC signer there, PKCE verification in the OAuth module, hex encoding rewritten each time it is needed. Password hashing uses a pure-JavaScript bcrypt implementation, one comparison uses `node:crypto`, and two Oslo packages are declared as dependencies without a single import.

These are the pieces most worth getting right once. Spreading them across call sites means each new security-relevant feature re-derives the same details.

## Context

### Current State

| Location                                   | Crypto in use                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------------- |
| `apps/r3-uptime/app/services/api-key.ts`   | `getRandomValues` for tokens, `subtle.digest("SHA-256")` for lookup                    |
| `apps/r3-uptime/app/services/alerts.ts`    | Local `hmacSha256Hex()` with a hand-rolled hex encoder                                 |
| `apps/auth/app/modules/oauth2.ts`          | `getRandomValues`, `subtle.digest` for PKCE S256, `timingSafeEqual` from `node:crypto` |
| `packages/oidc-provider/.../secret.ts`     | bcrypt hashing of client secrets                                                       |
| `packages/oidc-provider/.../credential.ts` | bcrypt hashing of user credentials                                                     |
| `apps/auth/package.json`                   | `@oslojs/crypto` and `@oslojs/encoding` declared, never imported                       |

The table above is the problem statement as it stood when this decision was made. Two of those paths have since moved: `apps/r3-uptime` is now `apps/uptime`, the React app of that name having been replaced by its Remix v3 port. See "Adoption Status" below for what has since shipped.

### Issues Identified

| Issue                                         | Impact                                                                              |
| --------------------------------------------- | ----------------------------------------------------------------------------------- |
| Hex and base64url encoding rewritten per site | Small differences (padding, case) become interoperability bugs                      |
| Two unused dependencies                       | Dependency surface without value                                                    |
| `node:crypto` import for one comparison       | Requires Node compatibility for something WebCrypto-era code can do itself          |
| Pure-JavaScript bcrypt                        | Deliberately slow hashing on a CPU-metered runtime, with no tunable parameters      |
| No TOTP support                               | Second-factor authentication in the OIDC provider has no primitive to build on      |
| No symmetric encryption                       | Client secrets and API credentials are stored hashed or plain, with no third option |

## Decision

Create `@pkg/crypto`: WebCrypto-based primitives with `Result`-based errors, no Node built-ins, and no third-party crypto dependencies.

### 1. Encoding

```ts
Hex.encode(bytes);
Hex.decode(text);
Base64Url.encode(bytes);
Base64Url.decode(text);
```

One implementation, used by every other module in the package and by `@pkg/http/cache` for `ETag` values.

### 2. Hashing And HMAC

```ts
await sha256(data); // Uint8Array
await hmac.sign(secret, payload, { hash: "SHA-256" });
await hmac.verify(secret, payload, signature); // constant-time
timingSafeEqual(a, b);
```

`timingSafeEqual` is implemented in the package as a constant-time comparison over byte arrays, so no `node:crypto` import is needed anywhere.

### 3. Random Values And Tokens

```ts
randomBytes(32);
randomToken({ bytes: 32 }); // base64url, URL-safe
randomToken({ bytes: 32, prefix: "sk" }); // "sk_..." for greppable, revocable keys
```

### 4. Password Hashing

PBKDF2-HMAC-SHA256 through WebCrypto, with a self-describing encoded output so parameters can be raised later without a schema change:

```ts
await password.hash("secret"); // "$pbkdf2-sha256$i=600000$<salt>$<hash>"
await password.verify(stored, "secret"); // Result<boolean, CryptoError>
password.needsRehash(stored); // true when stored parameters are below current policy
```

`needsRehash()` supports upgrade-on-login: verify with the stored parameters, then re-hash with current policy when the password is correct.

### 5. TOTP

```ts
let secret = totp.generateSecret();
await totp.code(secret, { at });
await totp.verify(secret, code, { window: 1 });
totp.uri(secret, { issuer, account });
```

RFC 6238 with a configurable step and drift window, plus the `otpauth://` URI for authenticator enrollment. This is the primitive the OIDC provider needs for second-factor support.

### 6. Symmetric Encryption

AES-GCM with a random IV and a versioned envelope, for values that must be read back rather than only compared:

```ts
let sealed = await seal(key, plaintext); // "v1.<iv>.<ciphertext>"
let opened = await open(key, sealed); // Result<string, CryptoError>
await importKey(rawBase64Url); // CryptoKey
```

The version prefix exists so an algorithm change does not require guessing the format of stored data.

### 7. Errors

Every asynchronous operation returns `Result`. A failed decryption, a malformed stored hash, and an unsupported algorithm are values, not exceptions, matching the repository's error handling rule.

## Consequences

### Positive

- **One implementation of each primitive** - encoding differences and comparison mistakes stop being per-call-site risks.
- **No Node built-ins and no crypto dependencies** - `@oslojs/*` and `bcryptjs` can both be removed, and `node:crypto` stops being imported.
- **Password parameters become tunable** - the encoded format carries its own cost parameters.
- **Second factor becomes buildable** - TOTP exists as a tested primitive rather than a future research task.
- **Encryption at rest becomes possible** - sealed values give a third option beside plaintext and irreversible hashes.
- **Faster on the target runtime** - WebCrypto PBKDF2 runs natively instead of iterating in JavaScript.

### Negative

- **Password migration is required** - existing bcrypt hashes must keep verifying until every user has logged in once, so both paths coexist for a while.
- **PBKDF2 is weaker per unit of cost than memory-hard alternatives** - Argon2 and scrypt are stronger choices where available, and WebCrypto offers neither, so iteration count carries the whole cost budget.
- **Key management moves to the apps** - sealed values need a key in the environment, with the rotation questions that implies.

### Neutral

- **JWT stays out of scope** - the existing JWT dependency remains; this package provides primitives, not token formats.
- **Existing hashed API keys are unaffected** - SHA-256 lookup hashing keeps its current semantics behind the new function.

## Implementation Plan

### Phase 1: Encoding, Hashing, HMAC

**Priority:** High
**Estimated Effort:** 3 hours

1. `Hex`, `Base64Url`, `sha256`, `hmac`, `timingSafeEqual`, `randomBytes`, `randomToken`.
2. Replace the local hex encoder and HMAC helper in the alerts service, and the `node:crypto` import in the OAuth module.

### Phase 2: Password Hashing

**Priority:** High
**Estimated Effort:** 3 hours

1. PBKDF2 hash, verify, `needsRehash`, encoded format, and tests including malformed stored values.
2. Add bcrypt verification as a compatibility path in the OIDC provider, plus rehash-on-login.

### Phase 3: TOTP And Sealing

**Priority:** Medium
**Estimated Effort:** 4 hours

1. TOTP with RFC 6238 test vectors.
2. AES-GCM seal and open with the versioned envelope.

### Phase 4: Cleanup

**Priority:** Medium
**Estimated Effort:** 1 hour

1. Remove `@oslojs/crypto`, `@oslojs/encoding`, and once migration completes, `bcryptjs`.
2. Write the package README and add it to the root README table (ADR-017).

## Alternatives Considered

### 1. Keep bcrypt

Leave password hashing as it is and only extract the utility primitives.

**Rejected because**: a pure-JavaScript key derivation function on a CPU-metered runtime is the worst combination available, and its cost parameter cannot be raised without the same migration this ADR already plans.

### 2. Adopt The Oslo Packages Properly

Use `@oslojs/crypto` and `@oslojs/encoding` as intended rather than removing them.

**Rejected because**: the primitives needed are thin wrappers over WebCrypto, the dependencies are currently unused, and the encoding helpers are a few dozen lines each. Owning them removes a supply-chain surface from the most security-sensitive code path.

### 3. Argon2 Via WebAssembly

Use a WebAssembly Argon2 build for password hashing.

**Rejected because**: it adds a WebAssembly module to every Worker that verifies a password, with bundle and cold-start cost, for a benefit that a sufficiently high PBKDF2 iteration count approximates. Worth revisiting if the runtime ever exposes a native memory-hard function.

## References

- [RFC 6238 - TOTP: Time-Based One-Time Password Algorithm](https://datatracker.ietf.org/doc/html/rfc6238)
- [RFC 8018 - PKCS #5: Password-Based Cryptography, PBKDF2](https://datatracker.ietf.org/doc/html/rfc8018)
- [MDN: Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [ADR-026: Standard Webhooks Parsing Package](./ADR-026-standard-webhooks-parsing-package.md)
- [ADR-022: HTTP Cache Policies And Conditional Responses](./ADR-022-http-cache-policies-and-conditional-responses.md)

## Current Progress

- [x] Phase 1: Encoding, Hashing, HMAC
- [x] Phase 2: Password Hashing
- [x] Phase 3: TOTP And Sealing
- [ ] Phase 4: Cleanup

### Adoption Status

| Site                                          | State                                                                         |
| --------------------------------------------- | ----------------------------------------------------------------------------- |
| `apps/auth/app/modules/oauth2.ts`             | Migrated: no `node:crypto`, no hand-rolled PKCE hashing or hex/base64url      |
| `apps/auth` password hashing                  | Migrated: new hashes are PBKDF2, with bcrypt verification and rehash-on-login |
| `apps/auth/package.json` Oslo packages        | Removed; they were declared but never imported                                |
| `packages/oidc-provider` secrets, credentials | Migrated: new hashes are PBKDF2, bcrypt retained for verifying stored hashes  |
| `apps/uptime/app/services/api-key.ts`         | Outstanding: still calls `getRandomValues` and `subtle.digest` directly       |
| `apps/uptime/app/services/alerts.ts`          | Outstanding: still carries a local `hmacSha256Hex` with its own hex encoder   |

Phase 4 stays open, and cannot close on a schedule. `bcryptjs` is required by `apps/auth` and `packages/oidc-provider` until no stored hash begins with `$2`, and every such hash is rewritten only when its owner next signs in successfully. The check that ends this phase is a query returning zero rows, not a deploy.

## Notes

- The bcrypt compatibility path is temporary but not short: it must stay until stored bcrypt hashes are gone, which depends on user logins, not on a deploy.
- PBKDF2 iteration count is a module-level constant so raising it is a one-line change plus a test update; stored hashes record the count they were made with.
- Sealed values are not searchable. Anything that must be looked up stays hashed with SHA-256, as API keys are today.
- The package must never log secrets, hashes, or ciphertext, including inside error values.
