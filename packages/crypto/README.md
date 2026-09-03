# @sdxc/crypto

WebCrypto primitives — encoding, digests, HMAC, tokens, password hashing, TOTP, and authenticated encryption — with `Result`-based errors.

## Overview

Cryptographic code goes wrong in small, repeatable ways: hex encoders that differ in letter case, base64 that breaks in a URL, comparisons that leak how many bytes matched, hashes stored without the parameters they were made with. This package implements each of those pieces once so no call site has to re-derive them.

Everything runs on the [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API), through `crypto.subtle` and `crypto.getRandomValues` only. There is **no `node:crypto` import** anywhere in the package and **no third-party crypto dependency** — the only runtime dependency is [`@sdxc/result`](/packages/result). That keeps it usable on any WebCrypto runtime without a Node compatibility layer, and keeps the most security-sensitive code path free of supply-chain surface.

Every asynchronous operation, and every decode that can fail, returns a `Result` instead of throwing: a failed decryption, a malformed stored hash, and an unsupported algorithm are values you handle, not exceptions you remember to catch. Error messages carry only the shape of the problem — never a secret, a hash, or ciphertext.

## Usage

### Encoding And Digests

```typescript
import { Hex, Base64, Base64Url, sha256 } from "@sdxc/crypto";
import { isSuccess } from "@sdxc/result";

let digest = await sha256(apiKey);
if (isSuccess(digest)) {
	let lookupHash = Hex.encode(digest.data); // "9f86d081..."
}

Base64Url.encode(new Uint8Array([255, 224])); // "_-A", no padding
Base64.encode("Aladdin:open sesame"); // "QWxhZGRpbjpvcGVuIHNlc2FtZQ==", padded
Hex.decode("zz"); // failure(InvalidEncodingError)
```

### Signing And Verifying A Payload

```typescript
import { hmac } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";

let signature = await hmac.sign(secret, body);
let valid = unwrap(await hmac.verify(secret, body, request.headers.get("x-signature") ?? ""));
```

### Tokens

```typescript
import { randomBytes, randomToken } from "@sdxc/crypto";

randomBytes(12); // Uint8Array(12)
randomToken(); // 43 base64url characters, 256 bits of entropy
randomToken({ bytes: 32, prefix: "sk" }); // "sk_9f1..." — greppable and revocable
```

### Passwords

```typescript
import { password } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";

let stored = unwrap(await password.hash(form.password));
// "$pbkdf2-sha256$i=600000$<salt>$<key>"

let valid = unwrap(await password.verify(stored, form.password));
if (valid && password.needsRehash(stored)) {
	stored = unwrap(await password.hash(form.password));
}
```

### Second Factor

```typescript
import { totp } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";

let secret = totp.generateSecret();
let uri = totp.uri(secret, { issuer: "Acme", account: "ada@example.com" });
let valid = unwrap(await totp.verify(secret, form.code, { window: 1 }));
```

### Encryption At Rest

```typescript
import { importKey, seal, open } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";

let key = unwrap(await importKey(env.SEAL_KEY));
let sealed = unwrap(await seal(key, refreshToken)); // "v1.<iv>.<ciphertext>"
let plaintext = unwrap(await open(key, sealed));
```

## API

### Encoding

#### `Hex.encode(data: BinaryLike): string`

Encodes bytes as lowercase hexadecimal, two characters per byte. Strings are read as UTF-8.

**Parameters:**

- `data`: Text or binary payload

**Returns:**

- Lowercase hex string

**Example:**

```typescript
Hex.encode(new Uint8Array([0, 255])); // "00ff"
```

#### `Hex.decode(text: string): Result<Bytes, InvalidEncodingError>`

Decodes a hex string, accepting either letter case. An odd length or a non-hex character fails instead of decoding partially, so a truncated signature can never compare equal to a prefix.

**Parameters:**

- `text`: Hex string

**Returns:**

- Decoded bytes, or `InvalidEncodingError`

#### `Base64Url.encode(data: BinaryLike): string`

Encodes bytes as base64url without `=` padding, using only `A-Z`, `a-z`, `0-9`, `-`, and `_`. Safe in URLs, headers, and file names.

#### `Base64Url.decode(text: string): Result<Bytes, InvalidEncodingError>`

Decodes base64url text with or without padding. The URL-safe alphabet is the whole accepted input set, and a short final group's leftover bits must be zero, so two accepted strings decode to the same bytes exactly when they differ only in trailing `=`.

#### `Base64.encode(data: BinaryLike): string`

Encodes bytes as standard base64 with `=` padding, using `A-Z`, `a-z`, `0-9`, `+`, and `/` — the alphabet RFC 4648 §4 defines. Strings are encoded as UTF-8 first, so a payload outside Latin-1 travels as the octets a peer decodes it back from, which is what the `user:password` credentials of HTTP Basic authentication require (RFC 7617 §2.1).

**Parameters:**

- `data`: Text or binary payload

**Returns:**

- Padded base64 string, always a multiple of four characters

**Example:**

```typescript
Base64.encode("Aladdin:open sesame"); // "QWxhZGRpbjpvcGVuIHNlc2FtZQ=="
Base64.encode(new Uint8Array([251, 255])); // "+/8="
```

#### `Base64.decode(text: string): Result<Bytes, InvalidEncodingError>`

Decodes standard base64 text carrying its full padding. The standard alphabet at a padded length is the whole accepted input set, and a short final group's leftover bits must be zero, so one byte string has exactly one accepted spelling.

**Parameters:**

- `text`: Padded base64 string

**Returns:**

- Decoded bytes, or `InvalidEncodingError`

### Hashing And HMAC

#### `sha256(data: BinaryLike): Promise<Result<Bytes, CryptoError>>`

Hashes a payload with SHA-256. Deterministic and unsalted, which makes it right for lookups and fingerprints — an API key stored as a digest can still be found by hashing the presented key — and wrong for passwords.

**Example:**

```typescript
let digest = unwrap(await sha256(apiKey));
let row = await findByKeyHash(Hex.encode(digest));
```

#### `sha384(data: BinaryLike): Promise<Result<Bytes, CryptoError>>`

Hashes a payload with SHA-384, returning 48 bytes.

#### `sha512(data: BinaryLike): Promise<Result<Bytes, CryptoError>>`

Hashes a payload with SHA-512, returning 64 bytes.

The three digests share one signature, so a protocol that picks its hash at runtime can select from a map built at the call site. OpenID Connect token hash claims (`at_hash`, `c_hash`, `s_hash`) work that way: the digest follows the ID token's `alg`, where `*256` means SHA-256, `*384` SHA-384, and `*512` SHA-512 (OpenID Connect Core §3.1.3.6).

```typescript
let digests = { "SHA-256": sha256, "SHA-384": sha384, "SHA-512": sha512 };
let digest = unwrap(await digests[hashFor(header.alg)](accessToken));
let atHash = Base64Url.encode(digest.subarray(0, digest.length / 2));
```

#### `hmac.sign(secret: BinaryLike, payload: BinaryLike, options?: hmac.Options): Promise<Result<Bytes, CryptoError>>`

Signs a payload with a secret.

**Parameters:**

- `secret`: Key material; text is read as UTF-8
- `payload`: Message to authenticate
- `options.hash`: `"SHA-1"`, `"SHA-256"` (default), `"SHA-384"`, or `"SHA-512"`

**Returns:**

- Raw MAC bytes, or `UnsupportedAlgorithmError` for an unknown hash

#### `hmac.verify(secret: BinaryLike, payload: BinaryLike, signature: BinaryLike, options?: hmac.Options): Promise<Result<boolean, CryptoError>>`

Recomputes the MAC and compares it in constant time. A `signature` given as a string is decoded as hex — the form `Hex.encode` produces and the form signature headers usually carry. A string that is not hex is reported as a plain mismatch rather than an error, so a malformed header fails closed without a second branch at the call site.

**Example:**

```typescript
if (!unwrap(await hmac.verify(secret, body, header))) return new Response(null, { status: 401 });
```

#### `timingSafeEqual(left: BinaryLike, right: BinaryLike): boolean`

Compares two values byte for byte with no early exit, so the running time does not depend on where or whether they differ. Lengths are assumed not to be secret: a length mismatch is detectable, only the content is protected.

**Example:**

```typescript
if (!timingSafeEqual(expectedVerifier, providedVerifier)) return reject();
```

### Random Values And Tokens

#### `randomBytes(size: number): Bytes`

Fills a new buffer with cryptographically strong random bytes.

**Parameters:**

- `size`: Integer from 0 to 65536, the most `crypto.getRandomValues` fills in one call

**Returns:**

- A fresh buffer of exactly `size` bytes

Throws `RangeError` for a size the runtime cannot fill — a programming mistake rather than a runtime condition.

#### `randomToken(options?: randomToken.Options): string`

Generates a URL-safe random token.

**Parameters:**

- `options.bytes`: Bytes of entropy, default `32`
- `options.prefix`: Prefix joined with `_`

**Returns:**

- The token, as `<prefix>_<random>` when a prefix is given

The prefix is not entropy. It exists so a token found in a log can be recognized and revoked by kind.

**Example:**

```typescript
randomToken({ bytes: 32, prefix: "sk" }); // "sk_..."
```

### Password Hashing

PBKDF2-HMAC-SHA256 through WebCrypto, at **600,000 iterations** with a 16-byte salt and a 32-byte derived key. The iteration count lives in a single module-level constant, so raising it is a one-line change.

#### Encoded Format

```
$pbkdf2-sha256$i=600000$<salt>$<key>
```

| Field           | Meaning                                         |
| --------------- | ----------------------------------------------- |
| `pbkdf2-sha256` | Algorithm tag; anything else is not this format |
| `i=600000`      | Iteration count the hash was produced with      |
| `<salt>`        | Random salt, unpadded base64url                 |
| `<key>`         | Derived key, unpadded base64url                 |

The format is self-describing: each hash carries the parameters it was made with, so verification uses the stored parameters and the current policy can be raised without a schema change or a mass reset.

#### `password.hash(secret: string): Promise<Result<string, CryptoError>>`

Hashes a password with the current policy and a fresh random salt. The same password hashes differently every time.

#### `password.verify(stored: string, secret: string): Promise<Result<boolean, CryptoError>>`

Checks a password against an encoded hash using the hash's own parameters. A wrong password is `success(false)`; only an unusable stored value or a runtime failure is a `Failure`, which keeps "wrong password" and "cannot check" apart.

**Returns:**

- `success(boolean)` for a readable hash
- `failure(MalformedHashError)` for a value not written in this format, including a bcrypt hash
- `failure(UnsupportedAlgorithmError)` for a well-formed value with another algorithm tag

#### `password.needsRehash(stored: string): boolean`

Reports whether a stored hash is behind current policy: a lower iteration count, a shorter salt or key, or a value that cannot be parsed at all. An unparsable value counts as needing a rehash, because a foreign hash is exactly what upgrade-on-login replaces.

### TOTP

RFC 6238 one-time passwords, verified against the RFC's published test vectors for SHA-1, SHA-256, and SHA-512. Defaults are the ones authenticator apps assume: a 30 second step, 6 digits, SHA-1, and a drift window of one step.

#### `totp.generateSecret(options?: totp.SecretOptions): string`

Generates a random shared secret as unpadded uppercase base32 — the only encoding authenticator apps accept in a QR code or a typed setup key.

**Parameters:**

- `options.bytes`: Secret size, default `20` (the 160 bits RFC 4226 recommends)

#### `totp.code(secret: string, options?: totp.CodeOptions): Promise<Result<string, CryptoError>>`

Generates the code for a secret at a point in time.

**Parameters:**

- `secret`: Base32 shared secret
- `options.at`: `Date` or epoch milliseconds, default now
- `options.step`: Step in seconds, default `30`
- `options.digits`: Digits in the code, default `6`, at most `10`
- `options.algorithm`: `"SHA-1"` (default), `"SHA-256"`, or `"SHA-512"`

#### `totp.verify(secret: string, code: string, options?: totp.VerifyOptions): Promise<Result<boolean, CryptoError>>`

Checks a submitted code against the current step and the drift window. Every step in the window is evaluated even after a match, and each comparison runs in constant time, so neither the total work nor the timing reveals which step matched. A code of the wrong shape is a plain mismatch, not an error.

**Parameters:**

- `options.window`: Steps accepted on either side of the current one, default `1`
- Plus every option `totp.code` takes, which must match how the code was generated

#### `totp.uri(secret: string, options: totp.UriOptions): string`

Builds the `otpauth://` URI an authenticator app scans during enrollment.

**Parameters:**

- `options.issuer`: Service name, used in both the label and the query
- `options.account`: Account identifier, usually an email address
- `options.digits`, `options.step`, `options.algorithm`: Reflected so the app mirrors them

**Example:**

```typescript
totp.uri(secret, { issuer: "Acme", account: "ada@example.com" });
// "otpauth://totp/Acme:ada%40example.com?secret=...&issuer=Acme&algorithm=SHA1&digits=6&period=30"
```

### Symmetric Encryption

AES-GCM with a random 96-bit IV per call, wrapped in a versioned envelope so an algorithm change never requires guessing the format of stored data:

```
v1.<iv>.<ciphertext>
```

#### `importKey(raw: string): Promise<Result<CryptoKey, CryptoError>>`

Imports raw base64url key material as a non-extractable AES-GCM key, so a leaked reference cannot be turned back into bytes.

**Parameters:**

- `raw`: Base64url-encoded key of 16, 24, or 32 bytes

**Returns:**

- The key, `InvalidKeyError` for the wrong size or rejected material, or `InvalidEncodingError` when the string is not base64url

Generate material with `randomToken({ bytes: 32 })`.

#### `seal(key: CryptoKey, plaintext: string): Promise<Result<string, CryptoError>>`

Encrypts a string into an envelope. The IV is random per call, so sealing the same plaintext twice yields different envelopes.

#### `open(key: CryptoKey, sealed: string): Promise<Result<string, CryptoError>>`

Decrypts an envelope produced by `seal`.

**Returns:**

- The plaintext, `InvalidEnvelopeError` for a malformed or unknown-version envelope, or `DecryptionError` when authentication fails

A wrong key and a tampered ciphertext produce the same `DecryptionError` with the same message, so failures cannot be used to probe which part of the value was altered.

### Errors

Every failure extends `CryptoError`, so one `instanceof` check covers the package while the subclasses let callers branch on the cause.

| Error                       | Raised when                                                |
| --------------------------- | ---------------------------------------------------------- |
| `CryptoError`               | Base class, and unexpected WebCrypto failures              |
| `InvalidEncodingError`      | A string is not valid hex, base64, base64url, or base32    |
| `MalformedHashError`        | A stored password hash does not follow the encoded format  |
| `UnsupportedAlgorithmError` | An algorithm identifier is valid but not supported here    |
| `InvalidKeyError`           | Key material is the wrong size or rejected by the runtime  |
| `InvalidEnvelopeError`      | A sealed value does not match the versioned envelope       |
| `DecryptionError`           | Authenticated decryption failed for a well-formed envelope |

No error message contains a secret, a hash, or ciphertext. Algorithm identifiers read back from stored values are sanitized to a short tag before they reach a message.

### Types

#### `BinaryLike`

```typescript
type BinaryLike = string | Uint8Array | ArrayBuffer;
```

Accepted wherever the package takes "bytes". Strings are read as UTF-8.

#### `Bytes`

```typescript
type Bytes = Uint8Array<ArrayBuffer>;
```

Returned wherever the package produces bytes. WebCrypto refuses views backed by a `SharedArrayBuffer`, so output is always in a form that can be fed straight back in.

## Pattern: Upgrade-On-Login

Verify with the parameters the stored hash records, then re-hash with current policy once the password is known to be correct. Raising `PBKDF2_ITERATIONS` starts migrating accounts on their next login, with no mass reset.

```typescript
let valid = await password.verify(user.passwordHash, form.password);
if (isFailure(valid) || !valid.data) return unauthorized();

if (password.needsRehash(user.passwordHash)) {
	let rehashed = await password.hash(form.password);
	if (isSuccess(rehashed)) await updatePasswordHash(user.id, rehashed.data);
}
```

## Pattern: Hashed Lookup, Sealed Storage

Sealed values are not comparable and not searchable, because the IV changes every time. Anything that must be looked up stays hashed; anything that must be read back gets sealed. A credential that needs both gets both columns.

```typescript
let token = randomToken({ bytes: 32, prefix: "sk" });

await store({
	lookupHash: Hex.encode(unwrap(await sha256(token))),
	sealedToken: unwrap(await seal(key, token)),
});
```

## Pattern: Verifying An Inbound Signature

Fail closed when the signing secret is missing, and let a malformed header fall through as a mismatch rather than a separate branch.

```typescript
let secret = env.WEBHOOK_SECRET;
if (!secret) return new Response(null, { status: 500 });

let body = await request.text();
let signature = request.headers.get("x-signature") ?? "";

let valid = await hmac.verify(secret, body, signature);
if (isFailure(valid) || !valid.data) return new Response(null, { status: 401 });
```

## Pattern: Enrolling A Second Factor

Store the secret, show the URI as a QR code, and only mark the factor as confirmed once the user proves possession with a code.

```typescript
let secret = totp.generateSecret();
let uri = totp.uri(secret, { issuer: "Acme", account: user.email });

// After the user submits a code from their authenticator app:
let confirmed = await totp.verify(secret, form.code, { window: 1 });
if (isSuccess(confirmed) && confirmed.data) await enableSecondFactor(user.id, secret);
```

## Related Packages

- [`@sdxc/result`](/packages/result) - `Result` type every operation here returns, with `unwrap`, `isSuccess`, and `match`
- [`@sdxc/typeid`](/packages/typeid) - Prefixed, sortable identifiers for records, where `randomToken` covers secrets

## Tips

1. **Hash for lookup, seal for retrieval** - `sha256` is deterministic and searchable; `seal` is neither. Pick by whether the value must be found or read back.
2. **Pick the codec by where the value travels** - `Base64Url` for URLs, headers, and file names; `Base64` where a spec calls for the standard padded alphabet, such as HTTP Basic credentials. Each decoder accepts only its own alphabet.
3. **Never use `sha256` for passwords** - it is unsalted and fast, which is the opposite of what a password needs. Use `password.hash`.
4. **Raise the iteration count in one place** - `PBKDF2_ITERATIONS` in `src/password.ts` is the whole policy; stored hashes keep verifying with the count they recorded.
5. **Treat `needsRehash` as the migration signal** - it also returns `true` for hashes written by another scheme, which is what makes a legacy compatibility path finite.
6. **Compare secrets with `timingSafeEqual`** - `===` on a token, a verifier, or a MAC leaks how many bytes matched.
7. **Prefer `hmac.verify` over comparing signatures yourself** - it recomputes and compares in constant time in one call.
8. **Keep the seal key out of the code** - read it from the environment, and remember that rotating it means re-sealing every stored value, since the envelope version does not identify the key.
9. **`randomToken` prefixes pay for themselves** - a leaked `sk_...` in a log is recognizable and revocable without decoding anything.
10. **Match TOTP options between generation and verification** - a mismatched `digits`, `step`, or `algorithm` fails silently as a wrong code.
11. **Let failures stay values** - a `Failure` from `open` or `verify` means "could not check", not "invalid". Reject on both, but do not log the value that failed.
