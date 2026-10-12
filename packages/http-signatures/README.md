# @sdxc/http-signatures

Sign and verify HTTP requests with RFC 9421 message signatures or draft-cavage-12, and parse and serialize their fields.

## Installation

```sh
npm add @sdxc/http-signatures
```

Keys are Web Crypto [`CryptoKey`](https://developer.mozilla.org/en-US/docs/Web/API/CryptoKey)s and every function answers a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result). Durations such as `maxAge` are [`@sdxc/duration`](https://www.npmjs.com/package/@sdxc/duration) strings.

## Usage

### Sign a request

`sign` answers a signed copy of the request. With `body`, it writes and covers a sha-256 digest of it; it also writes `Date` when the request has none.

```typescript
import { sign } from "@sdxc/http-signatures";
import { isFailure } from "@sdxc/result";

let body = new TextEncoder().encode(JSON.stringify({ type: "Note", content: "Hello" }));
let request = new Request("https://example.com/inbox", {
	method: "POST",
	headers: { "content-type": "application/json" },
	body,
});

let signed = await sign(request, {
	scheme: "rfc9421", // or "draft-cavage"
	key: { id: "https://example.com/keys/1", privateKey },
	body,
});
if (isFailure(signed)) throw signed.error;
await fetch(signed.data);
```

### Verify a request

`verify` reads whichever scheme the request carries and checks coverage, the body digest, freshness, the key and the signature, in that order.

```typescript
import { verify } from "@sdxc/http-signatures";
import { isFailure, success } from "@sdxc/result";

let verified = await verify(request, {
	body: await request.bytes(),
	maxAge: "1 hour",
	key: async (keyId) => success(await findPublicKey(keyId)), // CryptoKey or null
});
if (isFailure(verified)) return new Response(verified.error.code, { status: 401 });

verified.data; // { scheme, keyId, label, created, components }
```

### Read and write the fields

Each signature header has a parser and a serializer, for inspecting a request or building one by hand.

```typescript
import { parseSignatureInput, stringifySignatureInput } from "@sdxc/http-signatures";

let inputs = parseSignatureInput('sig1=("@method" "@target-uri");created=1618884473;keyid="k"');
// success({ sig1: { components: [{ name: "@method" }, { name: "@target-uri" }], params: { created: Date, keyid: "k" } } })

stringifySignatureInput({ sig1: { components: [{ name: "@method" }], params: { keyid: "k" } } });
// success('sig1=("@method");keyid="k"')
```

## API

### `sign(request: Request, options: SignOptions): Promise<Result<Request, HttpSignatureError>>`

Answers a copy of `request`, body included, carrying the signature.

- `scheme`: `"rfc9421"` writes `Signature-Input` and `Signature`; `"draft-cavage"` writes one `Signature` header with `algorithm="hs2019"`.
- `key`: `{ id, privateKey, algorithm? }`. The algorithm is read from the key when left out: RSASSA-PKCS1-v1_5 SHA-256 signs `rsa-v1_5-sha256`, RSA-PSS SHA-512 `rsa-pss-sha512`, ECDSA P-256 `ecdsa-p256-sha256` and Ed25519 `ed25519`.
- `body`: the exact body bytes. A sha-256 `Content-Digest` (rfc9421) or `Digest` (cavage) is written and covered.
- `components`: what to cover, in order. RFC 9421 takes names or `Component` objects; cavage takes header names plus `(request-target)`, `(created)` and `(expires)`. The defaults are `@method @target-uri content-digest content-type date` and `(request-target) host date digest content-type`, each without the digest when there is no body and without `content-type` when the request has none.
- `created`: the signing time, also written as `Date` when the request has none. Defaults to now.
- `expires`, `nonce`, `tag`: RFC 9421 signature parameters; `expires` also applies to cavage when `(expires)` is covered.
- `label`: the RFC 9421 label, `sig1` by default. A request signed again under another label keeps both signatures.

RFC 9421 signatures carry `created` and `keyid`, and the verifier's key decides the algorithm.

### `verify(request: Request, options: VerifyOptions): Promise<Result<Verified, HttpSignatureError>>`

`Signature-Input` selects RFC 9421; `Signature` alone, or `Authorization: Signature …`, selects draft-cavage-12. The checks run in order and stop at the first failure, so a stale or incomplete request never reaches the key lookup:

1. The signature covers the method, the target, the host, a time (`created` or `Date`) and, with a body, its digest.
2. Each covered `Content-Digest`, `Repr-Digest` or `Digest` matches the body.
3. `created` (else `Date`) is within `maxAge`, not in the future and before `expires`, each allowing `clockSkew`.
4. `key(keyId, algorithm)` answers a key; `algorithm` is the sender's declared `alg` or cavage `algorithm`, or `null`.
5. The key fits the declared algorithm. Cavage `hs2019` uses the key's own, and `rsa-sha256` requires an RSASSA-PKCS1-v1_5 SHA-256 key.
6. The signature verifies.

- `body`: the exact bytes received. Left out, a clone of the request is read.
- `key`: the `KeyLookup`.
- `maxAge`: how old a signature may be, such as `"1 hour"`.
- `clockSkew`: allowed clock difference, `"5 minutes"` by default.
- `now`: the time to check against, now by default.
- `label`: the RFC 9421 label to verify, by default the first one with a signature.

### `parseSignatureInput(text)` / `stringifySignatureInput(inputs)`

`Signature-Input` as `Record<label, SignatureInput>`. Parameter order survives a round trip, and `created` and `expires` read as `Date`.

### `parseSignature(text)` / `stringifySignature(signatures)`

`Signature` as `Record<label, Uint8Array>`.

### `parseAcceptSignature(text)` / `stringifyAcceptSignature(requests)`

`Accept-Signature`, the signatures a server asks for, as `Record<label, AcceptSignature>`. `created` and `expires` are `true` when requested.

### `parseCavageSignature(text)` / `stringifyCavageSignature(signature)`

The draft-cavage `Signature` value (or `Authorization` after `Signature `) as a `CavageSignature`. Without `headers`, `verify` covers `(created)` when the signature has `created` and `date` otherwise.

### `HttpSignatureError`

The failure every function answers with; `code` names the check:

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

- `Scheme`: `"rfc9421" | "draft-cavage"`.
- `Algorithm`: `"rsa-v1_5-sha256" | "rsa-pss-sha512" | "ecdsa-p256-sha256" | "ed25519"`.
- `Component`: `{ name, params? }`; `ComponentParameters` holds `sf`, `key`, `bs`, `req`, `tr` and `name` (for `@query-param`).
- `SignatureInput`: `{ components, params }`, with `SignatureParameters` `created`, `expires`, `nonce`, `alg`, `keyid` and `tag`.
- `AcceptSignature`: `{ components, params }`, with `AcceptSignatureParameters` like `SignatureParameters` but `created` and `expires` as flags.
- `CavageSignature`: `{ keyId, algorithm, created, expires, headers, signature }`, each optional field `null` when absent.
- `SigningKey`, `SignOptions`, `VerifyOptions`: the options above.
- `KeyLookup`: `(keyId, algorithm) => Promise<Result<CryptoKey | null, Error>>`.
- `Verified`: `{ scheme, keyId, label, created, components }`; `label` is `null` for cavage and `components` lists covered identifiers in order, parameters appended (`@query-param;name="id"`).
- `HttpSignatureErrorCode`: the codes in the table above.

## Pattern: Falling back from RFC 9421 to draft-cavage

Servers that predate RFC 9421 reject it. Sign with RFC 9421 first and retry once with cavage.

```typescript
import type { SigningKey } from "@sdxc/http-signatures";

import { sign } from "@sdxc/http-signatures";
import { unwrap } from "@sdxc/result";

async function deliver(inbox: string, body: Uint8Array, key: SigningKey) {
	let request = () =>
		new Request(inbox, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body,
		});

	let response = await fetch(unwrap(await sign(request(), { scheme: "rfc9421", key, body })));
	if (![400, 401, 403].includes(response.status)) return response;
	return fetch(unwrap(await sign(request(), { scheme: "draft-cavage", key, body })));
}
```

## Pattern: Verifying with keys from PEM

A key published as PEM imports through `Pem` from [`@sdxc/crypto`](https://www.npmjs.com/package/@sdxc/crypto). The lookup answers `success(null)` for an unknown key and a failure when the fetch breaks; both end as `key-unavailable`.

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

## Pattern: Answering verification failures

`code` separates a client to reject from a key you could not reach, so a handler answers each with its own status.

```typescript
import type { HttpSignatureErrorCode } from "@sdxc/http-signatures";

import { verify } from "@sdxc/http-signatures";
import { isFailure } from "@sdxc/result";

let STATUS: Record<HttpSignatureErrorCode, number> = {
	unsigned: 401,
	malformed: 400,
	"insufficient-coverage": 401,
	"missing-component": 400,
	"unsupported-component": 400,
	"digest-mismatch": 400,
	"stale-signature": 401,
	"key-unavailable": 503,
	"unsupported-algorithm": 401,
	"invalid-signature": 401,
	crypto: 500,
};

async function handle(request: Request) {
	let verified = await verify(request, {
		body: await request.bytes(),
		key: lookupKey,
		maxAge: "5 minutes",
	});
	if (isFailure(verified)) {
		return new Response(verified.error.message, { status: STATUS[verified.error.code] });
	}
	return Response.json({ signedBy: verified.data.keyId });
}
```

## Pattern: Asking for a signature with Accept-Signature

A server describes the signature it wants; the client signs exactly that, under the requested label and with its nonce.

```typescript
import { randomToken } from "@sdxc/crypto";
import {
	parseAcceptSignature,
	sign,
	stringifyAcceptSignature,
	verify,
} from "@sdxc/http-signatures";
import { isFailure, unwrap } from "@sdxc/result";

let nonce = randomToken();
let challenge = unwrap(
	stringifyAcceptSignature({
		sig1: {
			components: [{ name: "@method" }, { name: "@target-uri" }, { name: "date" }],
			params: { created: true, nonce },
		},
	}),
);
let rejected = new Response(null, { status: 401, headers: { "accept-signature": challenge } });

let requested = unwrap(parseAcceptSignature(rejected.headers.get("accept-signature") ?? ""));
let [[label, wanted]] = Object.entries(requested);
let signed = unwrap(
	await sign(new Request("https://example.com/resource"), {
		scheme: "rfc9421",
		key,
		label,
		components: wanted.components,
		nonce: wanted.params.nonce,
	}),
);

let verified = await verify(signed, { key: lookupKey, maxAge: "1 minute", label });
if (isFailure(verified)) throw verified.error;
```

`verify` checks the signature, not the nonce: confirm the request's `Signature-Input` nonce with `parseSignatureInput` against the one you issued.

## Pattern: Covering query parameters under a second signature

`Component` objects reach derived components such as `@query-param`, and a second `sign` under a new label keeps the first signature for a verifier that reads either.

```typescript
import { sign, verify } from "@sdxc/http-signatures";
import { unwrap } from "@sdxc/result";

let request = new Request("https://example.com/search?q=cats&page=2");

let first = unwrap(await sign(request, { scheme: "rfc9421", key: clientKey }));
let both = unwrap(
	await sign(first, {
		scheme: "rfc9421",
		key: proxyKey,
		label: "proxy",
		components: [
			"@method",
			"@target-uri",
			{ name: "@query-param", params: { name: "q" } },
			"date",
			{ name: "signature", params: { key: "sig1" } },
		],
	}),
);

let byProxy = unwrap(await verify(both, { key: lookupKey, maxAge: "1 minute", label: "proxy" }));
byProxy.components; // ["@method", "@target-uri", '@query-param;name="q"', "date", 'signature;key="sig1"']
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
