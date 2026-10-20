# @sdxc/crypto

Web Crypto primitives — encoding, hashing, HMAC, tokens, TOTP, AES-GCM — plus scrypt passwords, with `Result`-based errors.

## Installation

```sh
npm add @sdxc/crypto
```

Operations that can fail answer a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which installs with this package and supplies `unwrap`, `isSuccess` and `isFailure`. Everything runs on the [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) except password hashing, which uses scrypt from `node:crypto` (native in Node, Bun and Cloudflare Workers).

## Usage

### Hash and encode

```typescript
import { Base64Url, Hex, sha256 } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";

let digest = unwrap(await sha256("hello")); // 32 bytes
Hex.encode(digest); // "2cf24dba..."
Base64Url.encode(digest); // unpadded, URL-safe
Hex.decode("zz"); // failure(InvalidEncodingError)
```

Inputs accept a string (read as UTF-8), a `Uint8Array` or an `ArrayBuffer`. For browser code, the codecs alone ship as `@sdxc/crypto/encoding`, which imports only Web APIs:

```typescript
import { Base64Url } from "@sdxc/crypto/encoding";
```

### Sign and verify a payload

```typescript
import { Hex, hmac, randomToken } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";

let secret = randomToken({ prefix: "whsec" }); // "whsec_..."
let signature = Hex.encode(unwrap(await hmac.sign(secret, body)));
let valid = unwrap(await hmac.verify(secret, body, signature)); // true
```

### Hash a password

```typescript
import { password } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";

let stored = unwrap(await password.hash(form.password));
// "$scrypt$ln=15,r=8,p=3$<salt>$<key>"
let valid = unwrap(await password.verify(stored, form.password));
```

### Encrypt a value at rest

```typescript
import { importKey, open, randomToken, seal } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";

let material = randomToken({ bytes: 32 }); // keep this in a secret store
let key = unwrap(await importKey(material));
let sealed = unwrap(await seal(key, "refresh-token")); // "v1.<iv>.<ciphertext>"
let plaintext = unwrap(await open(key, sealed));
```

## API

### Encoding

Each codec has one output shape and a decoder that answers `Result<Bytes, InvalidEncodingError>` for malformed input. All four also ship from `@sdxc/crypto/encoding`.

#### `Hex.encode(data: BinaryLike): string` / `Hex.decode(text: string)`

Lowercase hex, two characters per byte. Decoding accepts either case and fails on an odd length or a non-hex character.

#### `Base64Url.encode(data: BinaryLike): string` / `Base64Url.decode(text: string)`

Unpadded base64url over `A-Z a-z 0-9 - _`, safe in URLs, headers and file names. Decoding accepts the text with or without trailing `=`.

```typescript
let text = Base64Url.encode(bytes);
// same as
let text = btoa(String.fromCharCode(...bytes))
	.replaceAll("+", "-")
	.replaceAll("/", "_")
	.replaceAll("=", "");
```

#### `Base64.encode(data: BinaryLike): string` / `Base64.decode(text: string)`

Standard padded base64 ([RFC 4648 §4](https://www.rfc-editor.org/rfc/rfc4648#section-4)). Strings encode as UTF-8, as HTTP Basic credentials require. Decoding requires the full padding.

#### `Base32.encode(data: BinaryLike): string` / `Base32.decode(text: string)`

Unpadded uppercase base32 over `A-Z 2-7`, for values typed by hand or scanned from a QR code. Decoding ignores case, padding, whitespace and dashes.

#### `Pem.encode(der: BinaryLike, label: string): Result<string, InvalidEncodingError>`

Armors DER bytes as PEM ([RFC 7468](https://www.rfc-editor.org/rfc/rfc7468)) under a label such as `PUBLIC KEY` (SPKI) or `PRIVATE KEY` (PKCS#8). Fails for a label RFC 7468 does not allow.

#### `Pem.decode(text: string, label: string): Result<Bytes, InvalidEncodingError>`

Answers the DER bytes of the first PEM block in `text`, ready for `crypto.subtle.importKey`. Fails when the block carries a different label, so a private key pasted where a public key belongs never imports.

### Bytes

#### `concatBytes(...parts: BinaryLike[]): Bytes`

Joins payloads end to end, reading strings as UTF-8, so a text label and its binary terminator combine in one call: `concatBytes("Content-Encoding: aes128gcm", new Uint8Array([0]))`.

### Hashing and HMAC

#### `sha256(data: BinaryLike): Promise<Result<Bytes, CryptoError>>`

SHA-256 digest (32 bytes). Deterministic and unsalted: right for lookups and fingerprints, wrong for passwords.

```typescript
let digest = unwrap(await sha256(apiKey));
// same as
let digest = new Uint8Array(
	await crypto.subtle.digest("SHA-256", new TextEncoder().encode(apiKey)),
);
```

#### `sha384(data: BinaryLike)` / `sha512(data: BinaryLike)`

The same call for SHA-384 (48 bytes) and SHA-512 (64 bytes).

#### `hmac.sign(secret: BinaryLike, payload: BinaryLike, options?: hmac.Options): Promise<Result<Bytes, CryptoError>>`

Answers the raw MAC bytes. `options.hash` is `"SHA-1"`, `"SHA-256"` (default), `"SHA-384"` or `"SHA-512"`; any other value fails with `UnsupportedAlgorithmError`.

#### `hmac.verify(secret: BinaryLike, payload: BinaryLike, signature: BinaryLike, options?: hmac.Options): Promise<Result<boolean, CryptoError>>`

Recomputes the MAC and compares it in constant time. A string `signature` is read as hex, and a string that is not hex answers `success(false)`, so a malformed header fails closed.

#### `timingSafeEqual(left: BinaryLike, right: BinaryLike): boolean`

Compares byte for byte with no early exit, so the running time depends only on the input lengths. Strings compare as their UTF-8 bytes.

### Random values

#### `randomBytes(size: number): Bytes`

Cryptographically strong random bytes, the same as `crypto.getRandomValues(new Uint8Array(size))`. Throws a `RangeError` unless `size` is an integer from 0 to 65536.

#### `randomToken(options?: randomToken.Options): string`

A base64url token from `options.bytes` of entropy (default `32`). `options.prefix` is joined with `_`, so a leaked token is recognizable by kind: `randomToken({ prefix: "sk" })` is `"sk_..."`. Use this for URL-safe secrets; use `randomString` when you need a custom alphabet.

#### `randomString(options?: randomString.Options): string`

A string of `options.length` characters (default `32`) drawn uniformly from `options.alphabet` (default `A-Z a-z 0-9`, no punctuation). Sampling uses rejection over `crypto.getRandomValues`, so every alphabet index is equally likely. Throws a `RangeError` when `length` is not an integer from 0 to 65536, or when `alphabet` is empty or longer than 256 characters.

```typescript
import { randomString } from "@sdxc/crypto";

let csrf = randomString({
	length: 32,
	alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+",
});
```

### Passwords

New hashes use scrypt at `ln=15, r=8, p=3` with a 16-byte salt and a 32-byte key, stored as `$scrypt$ln=15,r=8,p=3$<salt>$<key>`. Each hash records its own parameters, so a policy change needs no schema change.

#### `password.hash(secret: string): Promise<Result<string, CryptoError>>`

Hashes with the current policy and a fresh salt; the same password hashes differently every time.

#### `password.verify(stored: string, secret: string): Promise<Result<boolean, CryptoError>>`

A wrong password is `success(false)`. A stored value in another format fails with `MalformedHashError`, and a well-formed one tagged with another algorithm with `UnsupportedAlgorithmError`.

#### `password.needsRehash(stored: string): boolean`

`true` when the stored hash uses weaker parameters than current policy, or is not in this package's format.

#### `password.recognizes(stored: string): boolean`

`true` when the value is this package's scrypt format under any parameters; `false` for a foreign hash such as bcrypt.

### TOTP

[RFC 6238](https://www.rfc-editor.org/rfc/rfc6238) one-time passwords, defaulting to what authenticator apps assume: SHA-1, 6 digits, a 30-second step.

#### `totp.generateSecret(options?: totp.SecretOptions): string`

A random base32 secret from `options.bytes` of entropy (default `20`).

#### `totp.code(secret: string, options?: totp.CodeOptions): Promise<Result<string, CryptoError>>`

The code for a secret at `options.at` (a `Date` or epoch milliseconds, default now), with `options.step` (seconds), `options.digits` (at most `10`) and `options.algorithm` (`"SHA-1"`, `"SHA-256"` or `"SHA-512"`).

#### `totp.verify(secret: string, code: string, options?: totp.VerifyOptions): Promise<Result<boolean, CryptoError>>`

Accepts a code from the current step or `options.window` steps either side (default `1`), plus every `totp.code` option, which must match how the code was generated. Runs in constant time, and a code that is not all digits is a mismatch.

#### `totp.uri(secret: string, options: totp.UriOptions): string`

The `otpauth://` enrollment URI for a QR code. `options.issuer` and `options.account` name the entry; `digits`, `step` and `algorithm` are carried along so the app generates matching codes.

### Symmetric encryption

AES-GCM with a random IV per call, in a versioned `v1.<iv>.<ciphertext>` envelope that carries the authentication tag.

#### `importKey(raw: string): Promise<Result<CryptoKey, CryptoError>>`

Imports base64url key material of 16, 24 or 32 bytes as a non-extractable AES-GCM key. Fails with `InvalidEncodingError` for text that is not base64url and `InvalidKeyError` for the wrong size.

#### `seal(key: CryptoKey, plaintext: string): Promise<Result<string, CryptoError>>`

Encrypts a string into an envelope. Sealing the same value twice gives different envelopes, so pair it with `sha256` when the value must also be looked up.

#### `open(key: CryptoKey, sealed: string): Promise<Result<string, CryptoError>>`

Decrypts an envelope. Fails with `InvalidEnvelopeError` for a malformed or unknown-version envelope, and `DecryptionError` for a wrong key or tampered ciphertext alike.

### Errors

Every failure extends `CryptoError`, so one `instanceof` check covers the package.

| Error                       | When                                                       |
| --------------------------- | ---------------------------------------------------------- |
| `CryptoError`               | Base class, and runtime Web Crypto failures                |
| `InvalidEncodingError`      | Text is not valid hex, base64, base64url, base32 or PEM    |
| `MalformedHashError`        | A stored password hash is in another format                |
| `UnsupportedAlgorithmError` | An algorithm name is well-formed but unsupported           |
| `InvalidKeyError`           | Key material is the wrong size or rejected by the runtime  |
| `InvalidEnvelopeError`      | A sealed value is not a `v1.<iv>.<ciphertext>` envelope    |
| `DecryptionError`           | Authenticated decryption failed for a well-formed envelope |

### Types

#### `BinaryLike`

`string | Uint8Array | ArrayBuffer`, accepted wherever the package takes bytes. Strings are read as UTF-8.

#### `Bytes`

`Uint8Array<ArrayBuffer>`, returned wherever the package produces bytes, and accepted directly by `crypto.subtle`.

#### `hmac.Options`, `hmac.Hash`

The `hash` option and its allowed names.

#### `randomToken.Options`

`bytes` and `prefix`.

#### `randomString.Options`

`length` and `alphabet`.

#### `totp.SecretOptions`, `totp.CodeOptions`, `totp.VerifyOptions`, `totp.UriOptions`, `totp.Algorithm`

The option objects of each `totp` function, and the allowed hash names.

## Pattern: Upgrade Password Hashes On Login

Verify with the parameters the stored hash records, then re-hash under current policy while the plaintext is at hand. Accounts migrate on their next login.

```typescript
import { password } from "@sdxc/crypto";
import { isFailure, isSuccess } from "@sdxc/result";

async function login(user: { id: string; passwordHash: string }, secret: string) {
	if (!password.recognizes(user.passwordHash)) return verifyLegacy(user, secret);

	let valid = await password.verify(user.passwordHash, secret);
	if (isFailure(valid) || !valid.data) return false;

	if (password.needsRehash(user.passwordHash)) {
		let rehashed = await password.hash(secret);
		if (isSuccess(rehashed)) await savePasswordHash(user.id, rehashed.data);
	}
	return true;
}
```

## Pattern: API Keys With Hashed Lookup And Sealed Storage

A sealed value can be read back but never searched, because its IV changes every time. Store the digest to find the key and the envelope to show it again.

```typescript
import { Hex, importKey, open, randomToken, seal, sha256 } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";

let key = unwrap(await importKey(sealKeyMaterial));

let apiKey = randomToken({ prefix: "sk" });
await saveApiKey({
	lookupHash: Hex.encode(unwrap(await sha256(apiKey))),
	sealedKey: unwrap(await seal(key, apiKey)),
});

let presented = request.headers.get("authorization")?.replace("Bearer ", "") ?? "";
let record = await findApiKey(Hex.encode(unwrap(await sha256(presented))));
let revealed = record ? unwrap(await open(key, record.sealedKey)) : null;
```

## Pattern: Verify An Inbound Webhook Signature

Fail closed when the signing secret is missing; a malformed signature header is already a plain mismatch.

```typescript
import { hmac } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";

async function handleWebhook(request: Request, secret: string | undefined) {
	if (!secret) return new Response(null, { status: 500 });

	let body = await request.text();
	let signature = request.headers.get("x-signature") ?? "";

	let valid = await hmac.verify(secret, body, signature, { hash: "SHA-256" });
	if (isFailure(valid) || !valid.data) return new Response(null, { status: 401 });

	return new Response(null, { status: 204 });
}
```

## Pattern: Enroll A Second Factor With Recovery Codes

Show the URI as a QR code, confirm the factor once the user proves possession, and hand out base32 recovery codes stored as digests.

```typescript
import { Base32, Hex, randomBytes, sha256, totp } from "@sdxc/crypto";
import { isSuccess, unwrap } from "@sdxc/result";

let secret = totp.generateSecret();
let uri = totp.uri(secret, { issuer: "Acme", account: "ada@example.com" });

let confirmed = await totp.verify(secret, form.code, { window: 1 });
if (isSuccess(confirmed) && confirmed.data) {
	let recoveryCodes = Array.from({ length: 8 }, () => Base32.encode(randomBytes(10)));
	let hashes = await Promise.all(
		recoveryCodes.map(async (code) => Hex.encode(unwrap(await sha256(code)))),
	);
	await enableSecondFactor({ secret, recoveryCodeHashes: hashes });
}
```

## Pattern: Publish And Import A Public Key As PEM

Export a Web Crypto key as SPKI, armor it for a profile or a config file, and turn the PEM back into a verification key on the other side.

```typescript
import { Pem } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";

let algorithm = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };

let spki = await crypto.subtle.exportKey("spki", keyPair.publicKey);
let publicKeyPem = unwrap(Pem.encode(spki, "PUBLIC KEY"));

let der = unwrap(Pem.decode(publicKeyPem, "PUBLIC KEY"));
let publicKey = await crypto.subtle.importKey("spki", der, algorithm, false, ["verify"]);
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
