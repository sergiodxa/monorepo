# @sdxc/openpgp

OpenPGP (RFC 9580) signing and verification on Web Crypto: ASCII armor, version 4 and 6 keys, cleartext signed messages and detached signatures.

## Installation

```sh
npm add @sdxc/openpgp
```

Every function answers a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result); failures are an `OpenPgpError` whose `code` names the step that failed. Everything runs on [Web Crypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto), so it works unchanged in Workers, browsers, Node and Bun.

**Out of scope:** encryption and decryption, the web of trust (third-party certifications, trust signatures, ownertrust) and keyservers. Use GnuPG or Sequoia for those.

## Usage

### Generate a signing key

```typescript
import { generateKey } from "@sdxc/openpgp";
import { unwrap } from "@sdxc/result";

let key = unwrap(await generateKey({ userId: "Security <security@example.com>" }));
key.fingerprint; // 64 hex characters for a version 6 key
key.armor(); // -----BEGIN PGP PRIVATE KEY BLOCK-----
key.publicKey.armor(); // -----BEGIN PGP PUBLIC KEY BLOCK-----
```

The default is a version 6 Ed25519 key. GnuPG 2.2 and other RFC 4880 tools read only version 4 keys, so pass `version: 4` (Ed25519Legacy) when they must verify your signatures.

### Sign and verify a cleartext message

```typescript
import { readPrivateKey, readPublicKey, signCleartext, verifyCleartext } from "@sdxc/openpgp";
import { isSuccess, unwrap } from "@sdxc/result";

let key = unwrap(await readPrivateKey(armoredPrivateKey));
let signed = unwrap(await signCleartext("Contact: mailto:security@example.com\n", key));

let certificate = unwrap(await readPublicKey(armoredPublicKey));
let verified = await verifyCleartext(signed, certificate);
if (isSuccess(verified)) verified.data.text; // the signed text
```

### Detached signatures

```typescript
import { signDetached, verifyDetached } from "@sdxc/openpgp";

let signature = await signDetached(fileBytes, key); // { binary, armored }
let verified = await verifyDetached(fileBytes, armoredSignature, certificate);
```

### Passphrase-protected keys

```typescript
let locked = unwrap(await key.lock("correct horse battery staple"));
let unlocked = await readPrivateKey(locked.armor(), { passphrase: "correct horse battery staple" });
```

## API

### `generateKey(options?): Promise<Result<PrivateKey>>`

Generates an Ed25519 signing key with its self-signatures. The options are `userId`, `version` (`6` or `4`), `algorithm` (`"ed25519"`, or `"ed25519-legacy"` for version 4) and `date`.

### `readPrivateKey(input, options?)` / `readPublicKey(input)`

Reads the first key in armored text or binary packets. `readPublicKey` also accepts a private key block and drops its secrets. A protected private key reads `locked` unless `passphrase` is given. Unlocking supports AEAD with GCM, CFB and version 4 MalleableCFB keys under Simple, Salted or Iterated-and-Salted S2K, which covers every key GnuPG exports. Argon2, OCB and EAX keys answer `unsupported`, because Web Crypto cannot compute them.

### `PrivateKey` / `PublicKey`

`fingerprint`, `keyId`, `version`, `userIds`, `toBytes()` and `armor()`. `PrivateKey` adds `publicKey`, `locked`, `unlock(passphrase)` and `lock(passphrase)`. `lock()` uses Iterated-and-Salted SHA-256 (16 MiB), HKDF and AES-256-GCM. `parts` exposes the packets.

### `signCleartext(text, key, options?)` / `verifyCleartext(message, keys)`

A cleartext signed message (RFC 9580 §7). Trailing whitespace is removed from each line, lines starting with `-` or `From ` are dash-escaped, and a version 4 key adds the `Hash` header. Verification accepts one certificate or a list. It answers the signed text and a `VerifiedSignature` with `signingKey`, `primaryKey`, `created`, `hash` and `text`.

### `signDetached(data, key, options?)` / `verifyDetached(data, signature, keys)`

A detached signature: binary (type 0x00) by default, or a text signature with `text: true`. Signing answers `{ binary, armored }`.

### `readCleartext(message)`

Splits a cleartext signed message into `text`, `hashes` and binary `signature` without verifying it. It fails on any armor header other than `Hash`.

### `verifyKey(certificate)`

Checks every self-signature and answers the primary key's status (`revoked`, `expires`, `canSign`, `bound`), each User ID's certification and each subkey's binding.

### `armor(type, data, options?)` / `dearmor(text)` / `crc24(data)`

ASCII armor for `"message"`, `"public-key"`, `"private-key"` and `"signature"`. The CRC24 footer is written only with `checksum: true`, and is reported but never refused when read.

### `readPackets(bytes)` / `writePacket(type, body)`

Packet framing in both header formats, including partial body lengths.

### Algorithms

Signing and verification support Ed25519 (v6 ID 27, and v4), Ed25519Legacy (v4), ECDSA on P-256, P-384 and P-521, and RSA PKCS#1 v1.5. The hash is SHA-256, SHA-384 or SHA-512, and signatures default to SHA-512. Signatures over MD5, SHA-1 or RIPEMD-160 are refused.

## Pattern: Sign a security.txt

RFC 9116 recommends serving security.txt as an OpenPGP cleartext signed message:

```typescript
import { readPrivateKey, signCleartext } from "@sdxc/openpgp";
import { isSuccess } from "@sdxc/result";

let key = await readPrivateKey(env.SECURITY_TXT_SIGNING_KEY);
let body = "Contact: mailto:security@example.com\nExpires: 2027-01-01T00:00:00Z\n";
let signed = isSuccess(key) ? await signCleartext(body, key.data) : null;
return new Response(signed && isSuccess(signed) ? signed.data : body, {
	headers: { "Content-Type": "text/plain; charset=utf-8" },
});
```

A key made with GnuPG works as is: `gpg --armor --export-secret-keys <fingerprint>`.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/openpgp": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
