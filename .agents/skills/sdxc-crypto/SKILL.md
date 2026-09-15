---
name: sdxc-crypto
description: "@sdxc/crypto wraps WebCrypto in `Result`-returning helpers: `Hex`/`Base64`/`Base64Url`, `sha256`/`sha384`/`sha512`, `hmac.sign`/`verify`, `timingSafeEqual`, `randomBytes`/`randomToken`, scrypt `password.hash`/`verify`/`needsRehash`, RFC 6238 `totp`, and AES-GCM `importKey`/`seal`/`open`. Use when storing a password, verifying a webhook signature, enrolling a TOTP second factor, encrypting a token at rest, or generating an API key."
---

# @sdxc/crypto

The cryptographic primitives an application actually reaches for, each with the encoding and key-import boilerplate WebCrypto makes you write by hand, and each returning a `Result` instead of throwing. Encoding (`Hex`, `Base64`, `Base64Url`), digests (`sha256`, `sha384`, `sha512`), `hmac.sign`/`hmac.verify`, `timingSafeEqual`, `randomBytes`/`randomToken`, `password.*`, `totp.*`, and `importKey`/`seal`/`open` for AES-GCM. Everything runs on `crypto.subtle` and `crypto.getRandomValues`, with one exception: scrypt has no Web Crypto equivalent, so password hashing reaches for `node:crypto`, which Node, Bun and Cloudflare Workers each implement natively.

Full API, options and examples: [packages/crypto/README.md](packages/crypto/README.md)

## When to reach for it

- Storing a user password, or upgrading a stored hash to current policy on the next successful login.
- Checking the signature header on an inbound webhook, without writing a constant-time comparison by hand.
- Enrolling a second factor: a base32 secret, the `otpauth://` URI for the QR code, and code verification with a drift window.
- Encrypting a refresh token or similar secret before it goes into a database, and reading it back.
- Turning bytes into a URL-safe token, or an API key into a deterministic digest a lookup column can index.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/crypto": "workspace:*" } }
```

```ts
import { Hex, hmac, password, randomToken, sha256 } from "@sdxc/crypto";
import { isFailure, unwrap } from "@sdxc/result";

let digest = unwrap(await sha256(apiKey));
let lookupHash = Hex.encode(digest); // "9f86d081..."

let secret = randomToken({ bytes: 32, prefix: "whsec" });
let valid = await hmac.verify(secret, body, request.headers.get("x-signature") ?? "");
if (isFailure(valid) || !valid.data) return new Response(null, { status: 401 });

let stored = unwrap(await password.hash(form.password));
// "$scrypt$ln=15,r=8,p=3$<salt>$<key>"
```

## Suggestions

- A wrong password, a wrong TOTP code and a malformed signature header are all `success(false)`, not failures — a `Failure` means the input was structurally wrong (`MalformedHashError`, `InvalidEncodingError`) or the runtime refused. Branch on the value, not on the presence of an error.
- Every error extends `CryptoError`, so one `instanceof` covers the package while the subclasses let a caller branch on the cause.
- Sealed values are neither comparable nor searchable, because the IV is random per call. A credential that must be both looked up and read back gets two columns: `sha256` for the lookup, `seal` for the storage.
- Stored password hashes carry the parameters they were made with, so `password.needsRehash()` plus a re-hash after a successful verify migrates accounts without a schema change or a mass reset.
- `sha256` is deterministic and unsalted: right for API key lookups and fingerprints, wrong for passwords.
- `randomBytes(size)` throws a `RangeError` outside 0–65536, the most `crypto.getRandomValues` fills in one call — it is the one throwing export.

## Related

- `@sdxc/result` — the `Result` every fallible operation returns; skill `sdxc-result`
- `@sdxc/webhooks` — builds on the HMAC signing and verification here; skill `sdxc-webhooks`
