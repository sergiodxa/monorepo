# @sdxc/http-signatures

Sign and verify HTTP requests with RFC 9421 message signatures or draft-cavage-12, and parse and serialize their fields.

## Installation

```sh
npm add @sdxc/http-signatures
```

Keys are Web Crypto [`CryptoKey`](https://developer.mozilla.org/en-US/docs/Web/API/CryptoKey)s, and every function answers a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result). Body digests come from [`@sdxc/digest-fields`](https://www.npmjs.com/package/@sdxc/digest-fields) and durations such as `maxAge` are [`@sdxc/duration`](https://www.npmjs.com/package/@sdxc/duration) strings; all three install with this package.

## Usage

Signing a POST. `sign` writes `Date` when the request has none, adds the body's digest, and covers it:

```typescript
import { sign } from "@sdxc/http-signatures";
import { isFailure } from "@sdxc/result";

let body = new TextEncoder().encode(JSON.stringify(activity));
let request = new Request(inbox, {
	method: "POST",
	headers: { "content-type": "application/activity+json" },
	body,
});

let signed = await sign(request, {
	scheme: "rfc9421", // or "draft-cavage"
	key: { id: "https://example.com/actor#main-key", privateKey },
	body,
});
if (isFailure(signed)) throw signed.error;
await fetch(signed.data);
```

Verifying an incoming request, whichever scheme it uses:

```typescript
import { verify } from "@sdxc/http-signatures";
import { isFailure } from "@sdxc/result";

let body = await request.bytes();
let verified = await verify(request, {
	body,
	key: (keyId) => resolveKey(keyId), // Promise<Result<CryptoKey | null, Error>>
	maxAge: "1 hour",
});
if (isFailure(verified)) return new Response(verified.error.code, { status: 401 });

verified.data; // { scheme, keyId, label, created, components }
```

## API

### `sign(request: Request, options: SignOptions): Promise<Result<Request, HttpSignatureError>>`

Answers a copy of `request` carrying the signature, with its body carried over.

- `scheme`: `"rfc9421"` writes `Signature-Input` and `Signature`; `"draft-cavage"` writes one `Signature` header with `algorithm="hs2019"`.
- `key`: `{ id, privateKey, algorithm? }`. The algorithm is read from the key when left out: an RSASSA-PKCS1-v1_5 SHA-256 key signs `rsa-v1_5-sha256`, RSA-PSS SHA-512 `rsa-pss-sha512`, ECDSA P-256 `ecdsa-p256-sha256`, and Ed25519 `ed25519`.
- `body`: the exact body bytes. A sha-256 `Content-Digest` (rfc9421) or `Digest` (cavage) is written and covered.
- `components`: what to cover, in order. RFC 9421 takes names or `{ name, params }` objects; cavage takes header names and `(request-target)`, `(created)`, `(expires)`. The defaults are `@method @target-uri content-digest content-type date` and `(request-target) host date digest content-type`, leaving out the digest without a body and `content-type` when the request has none.
- `created`: the signing time, also written as `Date` (IMF-fixdate) when the request has none. Defaults to now.
- `expires`, `nonce`, `tag`: RFC 9421 signature parameters. `expires` also applies to cavage when `(expires)` is covered.
- `label`: the RFC 9421 label, `sig1` by default. Signing again under another label keeps the first signature.

RFC 9421 signatures carry `created` and `keyid` and leave out `alg`, so the verifier's key decides the algorithm.

### `verify(request: Request, options: VerifyOptions): Promise<Result<Verified, HttpSignatureError>>`

`Signature-Input` selects RFC 9421, and `Signature` alone (or `Authorization: Signature …`) selects draft-cavage-12. Checks run in this order and stop at the first failure, so a stale or incomplete request never costs a key fetch:

1. The signature covers the method, the target, the host (`@target-uri` carries it), a time (`created` or `date`) and, when there is a body, its digest.
2. Each covered `Content-Digest`, `Repr-Digest` or `Digest` matches the body.
3. `created` (else `Date`) is within `maxAge`, not in the future, and before `expires`, each allowing `clockSkew`.
4. `key(keyId, algorithm)` answers a key. `algorithm` is the sender's declared `alg` or cavage `algorithm`, or `null`.
5. The key's algorithm fits the declared one. Cavage `hs2019` takes the key's own algorithm, and `rsa-sha256` requires an RSASSA-PKCS1-v1_5 SHA-256 key.
6. The signature verifies.

Options:

- `body`: the exact bytes received. Left out, a clone of the request is read.
- `key`: the key lookup.
- `maxAge`: how old a signature may be, such as `"1 hour"`.
- `clockSkew`: allowed clock difference, `"5 minutes"` by default.
- `now`: the time to check against, now by default.
- `label`: the RFC 9421 label to verify, by default the first one that has a signature.

`Verified` is `{ scheme, keyId, label, created, components }`: `label` is `null` for cavage, and `components` lists covered names in order, parameters appended (`@query-param;name="Pet"`).

### `parseSignatureInput(text)` / `stringifySignatureInput(inputs)`

`Signature-Input` as `Record<label, { components, params }>`, through [`@sdxc/structured-fields`](https://www.npmjs.com/package/@sdxc/structured-fields). Parameter order survives a round trip, because the signature base serializes it as written. `created` and `expires` read as `Date`.

```typescript
parseSignatureInput('sig1=("@method" "@target-uri");created=1618884473;keyid="k"');
// success({ sig1: { components: [{ name: "@method" }, { name: "@target-uri" }], params: { created: Date, keyid: "k" } } })
```

### `parseSignature(text)` / `stringifySignature(signatures)`

`Signature` as `Record<label, Uint8Array>`.

### `parseAcceptSignature(text)` / `stringifyAcceptSignature(requests)`

`Accept-Signature` (RFC 9421 §5.1), the signatures a server asks for. `created` and `expires` are `true` when requested.

### `parseCavageSignature(text)` / `stringifyCavageSignature(signature)`

The draft-cavage `Signature` header as `{ keyId, algorithm, created, expires, headers, signature }`. `headers` is `null` when the header leaves it out; `verify` then covers `(created)` when there is a `created` parameter and `date` otherwise.

### `HttpSignatureError`

The failure every function answers with. `code` names the check:

| `code`                  | When                                                                    |
| ----------------------- | ----------------------------------------------------------------------- |
| `unsigned`              | No signature, or none under the requested label                         |
| `malformed`             | A signature field, component or parameter breaks its grammar            |
| `insufficient-coverage` | The signature leaves out the method, target, host, a time or the digest |
| `missing-component`     | A covered header, query parameter or digest field is absent             |
| `unsupported-component` | A component a request cannot provide, such as `@status` or `;req`       |
| `digest-mismatch`       | The body differs from the covered digest field                          |
| `stale-signature`       | Too old, dated in the future, or past `expires`                         |
| `key-unavailable`       | The key lookup failed or found nothing                                  |
| `unsupported-algorithm` | An unknown algorithm, or a key imported for another one                 |
| `invalid-signature`     | The signature does not verify                                           |
| `crypto`                | Web Crypto refused to sign                                              |

### Types

`Scheme`, `Algorithm`, `Component`, `ComponentParameters`, `SignatureInput`, `SignatureParameters`, `AcceptSignature`, `AcceptSignatureParameters`, `CavageSignature`, `SigningKey`, `SignOptions`, `KeyLookup`, `VerifyOptions`, `Verified` and `HttpSignatureErrorCode` describe the values above.

## Pattern: Falling back from RFC 9421 to draft-cavage

Servers that predate RFC 9421 answer `401` to it. Sign with RFC 9421 first and retry once with cavage.

```typescript
import { sign } from "@sdxc/http-signatures";
import { unwrap } from "@sdxc/result";

async function deliver(
	inbox: string,
	body: Uint8Array,
	key: { id: string; privateKey: CryptoKey },
) {
	let request = () =>
		new Request(inbox, {
			method: "POST",
			headers: { "content-type": "application/activity+json" },
			body,
		});

	let response = await fetch(unwrap(await sign(request(), { scheme: "rfc9421", key, body })));
	if (![400, 401, 403].includes(response.status)) return response;
	return fetch(unwrap(await sign(request(), { scheme: "draft-cavage", key, body })));
}
```

## Pattern: Verifying with keys from PEM

A key published as PEM, such as an ActivityPub actor's `publicKeyPem`, imports through [`@sdxc/crypto`](https://www.npmjs.com/package/@sdxc/crypto)'s `Pem`.

```typescript
import { Pem } from "@sdxc/crypto";
import { verify } from "@sdxc/http-signatures";
import { failure, isFailure, success } from "@sdxc/result";

let verified = await verify(request, {
	maxAge: "1 hour",
	async key(keyId) {
		let pem = await findPublicKeyPem(keyId);
		if (pem === null) return success(null);
		let der = Pem.decode(pem, "PUBLIC KEY");
		if (isFailure(der)) return failure(der.error);
		let algorithm = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };
		return success(await crypto.subtle.importKey("spki", der.data, algorithm, false, ["verify"]));
	},
});
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/http-signatures": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
