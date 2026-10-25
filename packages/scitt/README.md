# @sdxc/scitt

SCITT Signed Statements, Receipts and a SCRAPI client for registering with a Transparency Service.

## Installation

```sh
npm add @sdxc/scitt
```

Every function answers a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which installs alongside this package. COSE signing comes from [`@sdxc/cbor`](https://www.npmjs.com/package/@sdxc/cbor)'s `cose` entry.

## Usage

[SCITT](https://www.rfc-editor.org/rfc/rfc9943) makes statements about software (an SBOM, a scan result, a release attestation) transparent: an issuer signs a statement, a Transparency Service appends it to a Merkle tree log and returns a Receipt, and anyone holding the service's key can check the statement is in the log without asking the service.

### Sign a statement

```typescript
import { JWK } from "@sdxc/jwt";
import { signStatement } from "@sdxc/scitt";
import { unwrap } from "@sdxc/result";

let key = await JWK.importKeyPair(await JWK.generateKeyPair("ES256"));

let statement = unwrap(
	await signStatement({
		issuer: "https://vendor.example",
		subject: "pkg:npm/@vendor/cli@1.2.3",
		contentType: "application/spdx+json",
		payload: sbomBytes,
		key, // any { id, alg, private }; an @sdxc/jwt key pair fits
	}),
);
```

The protected header carries the algorithm, the `kid`, the content type and the CWT claims with `iss` and `sub`. Pass `detached: true` to sign a payload that stays out of the message, such as the digest of a large artifact, and `issuedAt` to add an `iat` claim.

### Register it and get a Receipt

```typescript
import { attachReceipts, TransparencyService } from "@sdxc/scitt";

let service = new TransparencyService("https://transparency.example", {
	headers: { authorization: `Bearer ${token}` },
});

let receipt = unwrap(await service.submit(statement));
let transparent = unwrap(attachReceipts(statement, [receipt]));
```

`submit` posts to `/entries` and, when the service answers `202`, polls the `Location` until the Receipt is ready. It waits the `Retry-After` the service sends, and otherwise backs off exponentially with jitter, giving up as `pending` after `maxAttempts` (default 10).

### Verify a Transparent Statement

```typescript
import { verifyTransparentStatement } from "@sdxc/scitt";

let keys = unwrap(await service.keys()); // /.well-known/scitt-keys

let result = await verifyTransparentStatement(transparent, {
	keys,
	issuer: "https://transparency.example",
	issuerKey, // optional: also check the issuer's own signature
});
```

Each attached Receipt whose key is in `keys` must prove the statement's inclusion, and at least one must. A Receipt verifies when its inclusion proof leads from the statement's leaf hash to a Merkle root and the service's signature covers that root.

## API

### Statements

- `signStatement(options)`: a tagged COSE_Sign1 Signed Statement. `options`: `issuer`, `subject`, `payload`, `key`, and optionally `contentType`, `detached`, `issuedAt`, `claims` (more CWT claims) and `headers` (more protected header parameters).
- `readStatement(bytes)`: the `SignedStatement` (`issuer`, `subject`, `contentType`, `kid`, `algorithm`, `claims`, `payload`, `receipts`, `message`) without checking its signature. Fails `missing-claim` without `iss` and `sub`, and `malformed` without a `kid` or X.509 reference.
- `verifyStatement(statement, key, { payload?, algorithms? })`: the statement once the issuer's signature verifies.
- `attachReceipts(statement, receipts)`: the Transparent Statement, with Receipts appended to the unprotected header (label 394).
- `registeredEntry(statement)`: the statement with its unprotected header emptied, the bytes a Transparency Service logs and a Receipt's leaf hash is taken over.

### Receipts

- `readReceipt(bytes)`: the `Receipt` (`issuer`, `subject`, `kid`, `algorithm`, `vds`, `inclusionProofs`, `message`). Only the RFC9162_SHA256 tree is understood; any other fails `unsupported-vds`.
- `verifyReceipt(receipt, { entry, keys, issuer?, algorithms? })`: the `VerifiedReceipt` with its `root` and `proof`. `keys` is one `CryptoKey` or a COSE key set, searched by the receipt's `kid` and then by RFC 9679 thumbprint.
- `verifyTransparentStatement(bytes, { keys, issuer?, issuerKey?, payload? })`: the statement and the receipts that verified.
- `leafHash(entry)` / `rootFromInclusionProof(leaf, proof)`: the RFC 9162 hashing underneath.

### `TransparencyService`

`new TransparencyService(url, { headers?, maxAttempts?, backoff? })`, where `backoff` is an [`@sdxc/backoff`](https://www.npmjs.com/package/@sdxc/backoff) schedule.

- `register(statement)`: `{ location, receipt, retryAfter }`; `receipt` is `null` until registration finishes.
- `receipt(entry)`: `{ status: "registered", receipt }` or `{ status: "running", retryAfter }` for a `location` URL or an entry ID.
- `waitForReceipt(entry, { retryAfter?, signal? })`: polls until the Receipt is ready.
- `submit(statement)`: `register` and `waitForReceipt` in one call.
- `keys()` / `key(kid)`: the service's COSE key set, or one key by `kid`.

### Errors

- `SCITTError`: `code` is a COSE failure (`malformed`, `invalid-signature`, `unsupported-algorithm`, `unsupported-key`, `unknown-critical`) or `missing-claim`, `unsupported-vds`, `invalid-proof`, `unknown-key`, `untrusted-issuer`.
- `ServiceError`: `code` is `error-response` (with `status`, and the Concise Problem Details `title` and `detail`), `invalid-response`, `network-error` or `pending`; `retryAfter` holds the service's `Retry-After` in milliseconds.

### `Label`

The registered numbers: `Label.RECEIPTS` (394), `Label.VDS` (395), `Label.VDP` (396), `Label.ISS`, `Label.SUB`, `Label.IAT`, `Label.RFC9162_SHA256`, `Label.INCLUSION_PROOFS`.

## Specifications

- [RFC 9943](https://www.rfc-editor.org/rfc/rfc9943): SCITT architecture, Signed Statements and Transparent Statements.
- [RFC 9942](https://www.rfc-editor.org/rfc/rfc9942): COSE Receipts and the RFC9162_SHA256 inclusion proof.
- [draft-ietf-scitt-scrapi-11](https://datatracker.ietf.org/doc/draft-ietf-scitt-scrapi/11/): the SCITT Reference API.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/scitt": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
