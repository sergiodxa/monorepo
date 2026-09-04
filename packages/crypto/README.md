# @sdxc/crypto

WebCrypto primitives — encoding, digests, HMAC, tokens, password hashing, TOTP, and authenticated encryption — with `Result`-based errors.

## Installation

```bash
npm add @sdxc/crypto
```

Everything runs on the [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API), through `crypto.subtle` and `crypto.getRandomValues`, with one exception: scrypt has no Web Crypto equivalent, so password hashing reaches for `node:crypto`, which Node, Bun, and Cloudflare Workers each implement natively. Operations that can fail return a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which installs with this package and supplies `unwrap`, `isSuccess`, and `isFailure`.

## Usage

### Encoding and digests

```typescript
import { Base64, Base64Url, Hex, sha256 } from "@sdxc/crypto";
import { isSuccess } from "@sdxc/result";

let digest = await sha256(apiKey);
if (isSuccess(digest)) {
	let lookupHash = Hex.encode(digest.data); // "9f86d081..."
}

Base64Url.encode(new Uint8Array([255, 224])); // "_-A", no padding
Base64.encode("Aladdin:open sesame"); // "QWxhZGRpbjpvcGVuIHNlc2FtZQ==", padded
Hex.decode("zz"); // failure(InvalidEncodingError)
```

### Signing and verifying a payload

```typescript
import { hmac, randomToken } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";

let secret = randomToken({ bytes: 32, prefix: "whsec" });
let signature = await hmac.sign(secret, body);
let valid = unwrap(await hmac.verify(secret, body, request.headers.get("x-signature") ?? ""));
```

### Passwords

```typescript
import { password } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";

let stored = unwrap(await password.hash(form.password));
// "$scrypt$ln=15,r=8,p=3$<salt>$<key>"

let valid = unwrap(await password.verify(stored, form.password));
```

### Second factor

```typescript
import { totp } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";

let secret = totp.generateSecret();
let uri = totp.uri(secret, { issuer: "Acme", account: "ada@example.com" });
let valid = unwrap(await totp.verify(secret, form.code, { window: 1 }));
```

### Encryption at rest

```typescript
import { importKey, open, seal } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";

let key = unwrap(await importKey(sealKey)); // base64url, 16, 24, or 32 bytes
let sealed = unwrap(await seal(key, refreshToken)); // "v1.<iv>.<ciphertext>"
let plaintext = unwrap(await open(key, sealed));
```

## API

### Encoding

#### `Hex.encode(data: BinaryLike): string`

Encodes bytes as lowercase hexadecimal, two characters per byte: `Hex.encode(new Uint8Array([0, 255]))` is `"00ff"`. Strings are read as UTF-8.

#### `Hex.decode(text: string): Result<Bytes, InvalidEncodingError>`

Decodes a hex string, accepting either letter case. An odd length or a non-hex character fails the whole input, so a truncated signature compares unequal to a prefix.

#### `Base64Url.encode(data: BinaryLike): string`

Encodes bytes as base64url without `=` padding, using only `A-Z`, `a-z`, `0-9`, `-`, and `_`. Safe in URLs, headers, and file names.

```typescript
let text = Base64Url.encode(bytes);
// same as
let text = btoa(String.fromCharCode(...bytes))
	.replaceAll("+", "-")
	.replaceAll("/", "_")
	.replaceAll("=", "");
```

A string is read as its UTF-8 bytes first, and the encoder runs in a single pass over the input, so a multi-megabyte payload encodes without an intermediate binary string.

#### `Base64Url.decode(text: string): Result<Bytes, InvalidEncodingError>`

Decodes base64url text with or without padding. A short final group's leftover bits must be zero, so two accepted strings decode to the same bytes exactly when they differ only in trailing `=`.

#### `Base64.encode(data: BinaryLike): string`

Encodes bytes as standard base64 with `=` padding, over the `A-Z`, `a-z`, `0-9`, `+`, `/` alphabet RFC 4648 §4 defines. Strings become their UTF-8 bytes first, which is what the `user:password` credentials of HTTP Basic authentication require (RFC 7617 §2.1).

#### `Base64.decode(text: string): Result<Bytes, InvalidEncodingError>`

Decodes standard base64 text carrying its full padding. One byte string has exactly one accepted spelling.

### Hashing and HMAC

#### `sha256(data: BinaryLike): Promise<Result<Bytes, CryptoError>>`

Hashes a payload with SHA-256, returning 32 bytes. Deterministic and unsalted, which makes it right for lookups and fingerprints — an API key stored as a digest is still found by hashing the presented key — and wrong for passwords, which belong to `password.hash`.

```typescript
let digest = unwrap(await sha256(apiKey));
// same as
let digest = new Uint8Array(
	await crypto.subtle.digest("SHA-256", new TextEncoder().encode(apiKey)),
);
```

The wrapper supplies the UTF-8 encoding a string input needs and the view over the returned buffer. `sha384` and `sha512` are the same call under their own algorithm name.

Both sides throw on a runtime refusal, since `unwrap` raises the `Failure`. Reading the `Result` with `isSuccess` instead keeps that refusal a value, which is the difference every expansion here spells out with `unwrap`.

#### `sha384(data: BinaryLike): Promise<Result<Bytes, CryptoError>>`

Hashes a payload with SHA-384, returning 48 bytes.

#### `sha512(data: BinaryLike): Promise<Result<Bytes, CryptoError>>`

Hashes a payload with SHA-512, returning 64 bytes. The three digests share one signature, so a protocol that picks its hash at runtime — such as an OpenID Connect `at_hash` following the ID token's `alg` — selects from a map built at the call site.

#### `hmac.sign(secret: BinaryLike, payload: BinaryLike, options?: hmac.Options): Promise<Result<Bytes, CryptoError>>`

Signs a payload with a secret and returns the raw MAC bytes. `options.hash` is `"SHA-1"`, `"SHA-256"` (default), `"SHA-384"`, or `"SHA-512"`; any other value gives an `UnsupportedAlgorithmError`.

```typescript
let signature = unwrap(await hmac.sign(secret, body));
// same as
let key = await crypto.subtle.importKey(
	"raw",
	new TextEncoder().encode(secret),
	{ name: "HMAC", hash: "SHA-256" },
	false,
	["sign"],
);
let signature = new Uint8Array(
	await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)),
);
```

The key is imported per call and non-extractable, and lives only as long as the signature it produces.

#### `hmac.verify(secret: BinaryLike, payload: BinaryLike, signature: BinaryLike, options?: hmac.Options): Promise<Result<boolean, CryptoError>>`

Recomputes the MAC and compares it in constant time, taking the same `options` used to sign. A `signature` given as a string decodes as hex — the form `Hex.encode` produces and the form signature headers usually carry — and a string that is not hex reads as a plain mismatch, so a malformed header fails closed.

```typescript
let valid = unwrap(await hmac.verify(secret, body, signature));
// same as
let expected = unwrap(await hmac.sign(secret, body));
let valid = timingSafeEqual(expected, unwrap(Hex.decode(signature)));
```

The hex decode is where the two part ways: `verify` reads an undecodable string as `success(false)`, where `unwrap` on the last line raises the `InvalidEncodingError`.

#### `timingSafeEqual(left: BinaryLike, right: BinaryLike): boolean`

Compares two values byte for byte with no early exit, so the running time depends only on the input lengths. Lengths are assumed public; the content stays protected.

```typescript
let equal = timingSafeEqual(expected, provided);
// same as
let mismatch = expected.length ^ provided.length;
for (let index = 0; index < expected.length; index++) {
	mismatch |= expected[index] ^ provided[index % provided.length];
}
let equal = mismatch === 0;
```

The length difference seeds the accumulator, and the shorter input is read cyclically, so a wrong length is already a mismatch while the loop still walks every byte of `expected`. Strings compare as their UTF-8 bytes, and an empty input is settled before the loop.

### Random values and tokens

#### `randomBytes(size: number): Bytes`

Fills a new buffer with cryptographically strong random bytes. `size` is an integer from 0 to 65536, the most `crypto.getRandomValues` fills in one call; anything else throws a `RangeError`.

```typescript
let bytes = randomBytes(32);
// same as
let bytes = crypto.getRandomValues(new Uint8Array(32));
```

#### `randomToken(options?: randomToken.Options): string`

Generates a URL-safe unpadded base64url token, `randomToken({ bytes: 32, prefix: "sk" })` giving `"sk_..."`.

- `options.bytes`: bytes of entropy, default `32`
- `options.prefix`: prefix joined with `_`, so a token found in a log is recognizable and revocable by kind

### Password hashing

scrypt through `node:crypto`, at `ln=15, r=8, p=3` for 32 MiB of scratch memory, with a 16-byte salt and a 32-byte derived key, stored as `$scrypt$ln=15,r=8,p=3$<salt>$<key>` with the salt and key in unpadded base64url. Each hash carries the parameters it was made with, so verification uses the stored parameters and current policy rises without a schema change or a mass reset.

#### `password.hash(secret: string): Promise<Result<string, CryptoError>>`

Hashes a password with the current policy and a fresh random salt. The same password hashes differently every time.

#### `password.verify(stored: string, secret: string): Promise<Result<boolean, CryptoError>>`

Checks a password against an encoded hash using the hash's own parameters. A wrong password is `success(false)`, which keeps it apart from a `Failure`: `MalformedHashError` for a value written by another scheme, `UnsupportedAlgorithmError` for a well-formed value carrying another algorithm tag.

#### `password.needsRehash(stored: string): boolean`

Reports whether a stored hash is behind current policy: a lower iteration count, a shorter salt or key, or a value this package parses as foreign.

### TOTP

RFC 6238 one-time passwords, checked against the RFC's published test vectors for SHA-1, SHA-256, and SHA-512. Defaults match what authenticator apps assume: a 30 second step, 6 digits, SHA-1, and a drift window of one step.

#### `totp.generateSecret(options?: totp.SecretOptions): string`

Generates a random shared secret as unpadded uppercase base32 — the encoding authenticator apps accept in a QR code or a typed setup key. `options.bytes` defaults to `20`, the 160 bits RFC 4226 recommends.

#### `totp.code(secret: string, options?: totp.CodeOptions): Promise<Result<string, CryptoError>>`

Generates the code for a base32 secret at a point in time.

- `options.at`: `Date` or epoch milliseconds, default now
- `options.step`: step in seconds, default `30`
- `options.digits`: digits in the code, default `6`, at most `10`
- `options.algorithm`: `"SHA-1"` (default), `"SHA-256"`, or `"SHA-512"`

#### `totp.verify(secret: string, code: string, options?: totp.VerifyOptions): Promise<Result<boolean, CryptoError>>`

Checks a submitted code against the current step and a drift window of `options.window` steps on either side (default `1`), plus every option `totp.code` takes, which must match how the code was generated. Every step in the window is evaluated even after a match, and each comparison runs in constant time, so neither the total work nor the timing reveals which step matched. A code of the wrong shape is a plain mismatch.

#### `totp.uri(secret: string, options: totp.UriOptions): string`

Builds the `otpauth://` URI an authenticator app scans during enrollment. `options.issuer` and `options.account` name the entry; `options.digits`, `options.step`, and `options.algorithm` are reflected so the app mirrors them.

```typescript
totp.uri(secret, { issuer: "Acme", account: "ada@example.com" });
// "otpauth://totp/Acme:ada%40example.com?secret=...&issuer=Acme&algorithm=SHA1&digits=6&period=30"
```

### Symmetric encryption

AES-GCM with a random 96-bit IV per call, wrapped in a versioned `v1.<iv>.<ciphertext>` envelope so an algorithm change keeps stored data readable.

#### `importKey(raw: string): Promise<Result<CryptoKey, CryptoError>>`

Imports base64url key material of 16, 24, or 32 bytes as a non-extractable AES-GCM key, so a leaked reference stays unusable as bytes. Returns `InvalidKeyError` for the wrong size or rejected material, and `InvalidEncodingError` when the string is not base64url. Generate material with `randomToken({ bytes: 32 })`.

#### `seal(key: CryptoKey, plaintext: string): Promise<Result<string, CryptoError>>`

Encrypts a string into an envelope. The IV is random per call, so sealing the same plaintext twice yields different envelopes; hash a value with `sha256` when it also has to be searchable.

```typescript
let sealed = unwrap(await seal(key, refreshToken));
// same as
let iv = crypto.getRandomValues(new Uint8Array(12));
let ciphertext = await crypto.subtle.encrypt(
	{ name: "AES-GCM", iv },
	key,
	new TextEncoder().encode(refreshToken),
);
let sealed = `v1.${Base64Url.encode(iv)}.${Base64Url.encode(new Uint8Array(ciphertext))}`;
```

AES-GCM appends its authentication tag to the ciphertext, so the envelope carries the tag along with it and `open` gets an integrity check for free.

#### `open(key: CryptoKey, sealed: string): Promise<Result<string, CryptoError>>`

Decrypts an envelope produced by `seal`. Returns `InvalidEnvelopeError` for a malformed or unknown-version envelope, and `DecryptionError` when authentication fails. A wrong key and a tampered ciphertext produce the same `DecryptionError` with the same message, so failures stay useless as an oracle.

```typescript
let plaintext = unwrap(await open(key, sealed));
// same as, once the version tag and the field sizes check out
let [, encodedIv, encodedCiphertext] = sealed.split(".");
let iv = unwrap(Base64Url.decode(encodedIv));
let plaintext = new TextDecoder().decode(
	await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv },
		key,
		unwrap(Base64Url.decode(encodedCiphertext)),
	),
);
```

### Errors

Every failure extends `CryptoError`, so one `instanceof` check covers the package while the subclasses let callers branch on the cause. Messages carry only the shape of the problem, and algorithm identifiers read back from stored values are sanitized to a short tag first.

| Error                       | Raised when                                                |
| --------------------------- | ---------------------------------------------------------- |
| `CryptoError`               | Base class, and unexpected WebCrypto failures              |
| `InvalidEncodingError`      | A string is not valid hex, base64, base64url, or base32    |
| `MalformedHashError`        | A stored password hash follows another format              |
| `UnsupportedAlgorithmError` | An algorithm identifier is valid but unsupported here      |
| `InvalidKeyError`           | Key material is the wrong size or rejected by the runtime  |
| `InvalidEnvelopeError`      | A sealed value diverges from the versioned envelope        |
| `DecryptionError`           | Authenticated decryption failed for a well-formed envelope |

### Types

#### `BinaryLike`

`string | Uint8Array | ArrayBuffer`, accepted wherever the package takes "bytes". Strings are read as UTF-8.

#### `Bytes`

`Uint8Array<ArrayBuffer>`, returned wherever the package produces bytes. WebCrypto requires views over a non-shared `ArrayBuffer`, so output feeds straight back in.

## Pattern: upgrade on login

Verify with the parameters the stored hash records, then re-hash with current policy once the password is known to be correct. Accounts migrate on their next login.

```typescript
import { password } from "@sdxc/crypto";
import { isFailure, isSuccess } from "@sdxc/result";

let valid = await password.verify(user.passwordHash, form.password);
if (isFailure(valid) || !valid.data) return unauthorized();

if (password.needsRehash(user.passwordHash)) {
	let rehashed = await password.hash(form.password);
	if (isSuccess(rehashed)) await updatePasswordHash(user.id, rehashed.data);
}
```

## Pattern: hashed lookup, sealed storage

Sealed values are neither comparable nor searchable, because the IV changes every time. Anything that has to be looked up stays hashed; anything that has to be read back gets sealed, and a credential needing both gets both columns.

```typescript
import { Hex, importKey, randomToken, seal, sha256 } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";

let key = unwrap(await importKey(sealKey));
let token = randomToken({ bytes: 32, prefix: "sk" });

await store({
	lookupHash: Hex.encode(unwrap(await sha256(token))),
	sealedToken: unwrap(await seal(key, token)),
});
```

## Pattern: verifying an inbound signature

Fail closed when the signing secret is missing, and let a malformed header fall through as a mismatch instead of a separate branch.

```typescript
import { hmac } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";

if (!webhookSecret) return new Response(null, { status: 500 });

let body = await request.text();
let signature = request.headers.get("x-signature") ?? "";

let valid = await hmac.verify(webhookSecret, body, signature);
if (isFailure(valid) || !valid.data) return new Response(null, { status: 401 });
```

## Pattern: enrolling a second factor

Store the secret, show the URI as a QR code, and mark the factor confirmed once the user proves possession with a code.

```typescript
import { totp } from "@sdxc/crypto";
import { isSuccess } from "@sdxc/result";

let secret = totp.generateSecret();
let uri = totp.uri(secret, { issuer: "Acme", account: "ada@example.com" });

// Once the user submits a code from their authenticator app:
let confirmed = await totp.verify(secret, form.code, { window: 1 });
if (isSuccess(confirmed) && confirmed.data) await enableSecondFactor(secret);
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/crypto": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
