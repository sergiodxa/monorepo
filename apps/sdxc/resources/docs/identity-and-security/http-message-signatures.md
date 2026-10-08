---
title: Sign and verify HTTP requests
description: Sign requests with RFC 9421 or draft-cavage, verify them with a freshness window and replay checks, and attach and check Content-Digest, Repr-Digest and Digest.
section:
    title: Identity & security
    order: 5
order: 14
lastUpdated: 2026-10-08
---

A bearer token proves the caller once had a secret. An HTTP message signature proves more: this
method, on this URL, with these headers and this exact body, was signed by the holder of a
private key, within the last few minutes. A token copied out of a log cannot be replayed with a
different body, and the verifier holds only public keys, so its own database leaking hands
nobody the ability to sign.

This guide builds both ends between two services: one signs each request it sends, the other
verifies each request it receives, refuses a replay, and tells an unsigned caller what to sign.
Then it attaches body digests on their own, for downloads and uploads whose integrity matters
without a signature.

[`@sdxc/http-signatures`](/api/http-signatures) signs and verifies with
[RFC 9421](https://www.rfc-editor.org/rfc/rfc9421) and with
[draft-cavage-12](https://datatracker.ietf.org/doc/html/draft-cavage-http-signatures-12), the
older scheme much of the fediverse still speaks.
[`@sdxc/digest-fields`](/api/digest-fields) reads, writes and checks the
[RFC 9530](https://www.rfc-editor.org/rfc/rfc9530) `Content-Digest` and `Repr-Digest` and the
legacy `Digest`. [`@sdxc/crypto`](/api/crypto) reads PEM keys, and every call answers a
`Result` from [`@sdxc/result`](/api/result).

```bash
npm add @sdxc/http-signatures @sdxc/digest-fields @sdxc/crypto @sdxc/result \
	@sdxc/validate @sdxc/http remix
```

## Make a key pair

Keys are Web Crypto `CryptoKey`s. Ed25519 is short and fast; `sign` also takes RSA PKCS#1 v1.5
with SHA-256, RSA-PSS with SHA-512 and ECDSA P-256, and reads which one from the key. Generate a
pair once:

```bash
openssl genpkey -algorithm ed25519 -out signing.pem
openssl pkey -in signing.pem -pubout -out signing.pub.pem
npx wrangler secret put SIGNING_KEY < signing.pem
```

The private key stays with the sender as a secret. The public key goes to whoever verifies, who
stores it beside the key id the sender will name, such as `https://api.example.com/keys/1`.

## Sign the requests you send

`Pem.decode` turns the PEM into the bytes Web Crypto imports. Importing an Ed25519 key is cheap,
so the sender reads it per request rather than holding it in module state:

```typescript {% title="app/services/signing-key.ts" %}
import type { SigningKey } from "@sdxc/http-signatures";
import type { Result } from "@sdxc/result";

import { Pem } from "@sdxc/crypto";
import { isFailure, success, wrap } from "@sdxc/result";
import { env } from "cloudflare:workers";

const KEY_ID = "https://api.example.com/keys/1";

export async function signingKey(): Promise<Result<SigningKey, Error>> {
	let der = Pem.decode(env.SIGNING_KEY, "PRIVATE KEY");
	if (isFailure(der)) return der;

	let privateKey = await wrap(() =>
		crypto.subtle.importKey("pkcs8", der.data, { name: "Ed25519" }, false, [
			"sign",
		]),
	);
	if (isFailure(privateKey)) return privateKey;
	return success({ id: KEY_ID, privateKey: privateKey.data });
}
```

`sign` answers a copy of the request carrying the signature. Pass the exact body bytes as
`body`: it writes a SHA-256 `Content-Digest` of them and covers it, so the signature binds the
body without hashing a stream it cannot read twice:

```typescript {% title="app/services/partner-orders.ts" %}
import { sign } from "@sdxc/http-signatures";
import { isFailure, success } from "@sdxc/result";

import { signingKey } from "~/app/services/signing-key";

const ORDERS_URL = "https://partner.example.com/orders";

export async function sendOrder(order: { id: string; total: number }) {
	let key = await signingKey();
	if (isFailure(key)) return key;

	let body = new TextEncoder().encode(JSON.stringify(order));
	let request = new Request(ORDERS_URL, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body,
	});

	let signed = await sign(request, {
		scheme: "rfc9421",
		key: key.data,
		body,
		nonce: crypto.randomUUID(),
		tag: "orders",
	});
	if (isFailure(signed)) return signed;

	return success(await fetch(signed.data));
}
```

The request goes out with `Date`, `Content-Digest`, `Signature-Input` and `Signature`. By default
the signature covers `@method`, `@target-uri`, `content-digest`, `content-type` and `date`,
leaving out the digest when there is no body and `content-type` when the request has none.
`@target-uri` carries the scheme, host, path and query together, so the signature cannot be
moved to another URL. The signature parameters record `created` and the key id; `alg` stays out,
because the verifier's key decides the algorithm.

`nonce` makes each signature unique, which is what lets the verifier refuse a replay, and `tag`
names the protocol it was made for, so a signature made for one API cannot be presented to
another that trusts the same key. Neither is required. The rest of `SignOptions`:

- `components` replaces the default coverage, in order. Pass names, or
  `{ name, params }` objects for a component with parameters, such as
  `{ name: "@query-param", params: { name: "page" } }`.
- `created` is the signing time, now by default, also written as `Date` when the request has
  none. `expires` adds an expiry the verifier enforces.
- `label` names the signature, `sig1` by default. Signing again under another label keeps the
  first, so a request can carry signatures from two parties.

## Verify the requests you receive

`verify` reads `Signature-Input` and selects RFC 9421, or reads `Signature` (or
`Authorization: Signature …`) alone and selects draft-cavage, so one endpoint accepts both. Its
checks run in this order and stop at the first failure, so a stale or incomplete request never
costs a key lookup:

1. The signature covers the method, the target, the host, a time (`created` or `Date`) and,
   when there is a body, its digest.
2. Each covered `Content-Digest`, `Repr-Digest` or `Digest` matches the body.
3. `created`, else `Date`, is within `maxAge`, not in the future, and before `expires`, each
   allowing `clockSkew` (five minutes by default).
4. Your `key(keyId, algorithm)` lookup answers a public key, and the key fits the algorithm the
   sender declared.
5. The signature verifies.

The key lookup is yours. Here it reads the PEM a partner registered under its key id:

```typescript {% title="app/services/partner-keys.ts" %}
import type { Result } from "@sdxc/result";
import type { Database } from "remix/data-table";

import { Pem } from "@sdxc/crypto";
import { isFailure, success, wrap } from "@sdxc/result";

import { findPartnerKey } from "~/app/models/partners";

export async function partnerKey(
	db: Database,
	keyId: string,
): Promise<Result<CryptoKey | null, Error>> {
	let pem = await wrap(() => findPartnerKey(db, keyId));
	if (isFailure(pem)) return pem;
	if (pem.data === null) return success(null);

	let der = Pem.decode(pem.data, "PUBLIC KEY");
	if (isFailure(der)) return der;
	return await wrap(() =>
		crypto.subtle.importKey("spki", der.data, { name: "Ed25519" }, false, [
			"verify",
		]),
	);
}
```

A key id nobody registered answers `null`, which fails the request `key-unavailable`. The
endpoint verifies first and only then reads the body. Left without a `body` option, `verify`
reads a clone, so the original stream is still there for the schema:

```typescript {% title="app/http/controllers/orders.ts" %}
import { accepted, unprocessableEntity } from "@sdxc/http/response/json";
import { verify } from "@sdxc/http-signatures";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { refuseSignature } from "~/app/http/refuse-signature";
import { saveOrder } from "~/app/models/orders";
import { partnerKey } from "~/app/services/partner-keys";
import routes from "~/routes/web";

const ORDER = s.object({ id: s.string(), total: s.number() });

export default createAction(routes.orders.create, async (ctx) => {
	let verified = await verify(ctx.request, {
		key: (keyId) => partnerKey(ctx.db, keyId),
		maxAge: "5 minutes",
	});
	if (isFailure(verified)) return refuseSignature(ctx.log, verified.error);

	let order = await validate(ctx.request, ORDER);
	if (isFailure(order)) return unprocessableEntity({ issues: order.error.issues });

	await saveOrder(ctx.db, verified.data.keyId, order.data);
	return accepted({ id: order.data.id });
});
```

`verified.data` says what the signature established: `scheme`, the `keyId` that signed, the
RFC 9421 `label` (`null` for cavage), `created`, and the covered `components` in order, with
parameters appended, as in `@query-param;name="page"`. The key id is the caller's identity, so
the order is stored against it. When you already hold the body as bytes, pass it as `body` and
`verify` hashes those.

Verify before anything else reads the request. A partner's server has no session and no
`Origin` header, so if your app runs Remix's
[`cop()`](https://github.com/remix-run/remix/tree/main/packages/cop-middleware), exempt the
signed paths from it.

### Refuse in a way the caller can act on

Every failure is an `HttpSignatureError` whose `code` names the check. All of them mean the
request is not proven, so all answer `401`; what differs is what you log and what you tell the
caller. `Accept-Signature` (RFC 9421 §5.1) says which signature you would accept, so a caller
that signed too little learns what to cover:

```typescript {% title="app/http/refuse-signature.ts" %}
import type { HttpSignatureError } from "@sdxc/http-signatures";
import type { Log } from "@sdxc/logger";

import { unauthorized } from "@sdxc/http/response/json";
import { stringifyAcceptSignature } from "@sdxc/http-signatures";
import { isFailure } from "@sdxc/result";

export function refuseSignature(log: Log, error: HttpSignatureError): Response {
	log.warn("signature.rejected", { code: error.code });

	let accept = stringifyAcceptSignature({
		sig1: {
			components: [
				{ name: "@method" },
				{ name: "@target-uri" },
				{ name: "content-digest" },
				{ name: "content-type" },
			],
			params: { created: true, tag: "orders" },
		},
	});
	if (isFailure(accept)) return unauthorized({ error: error.code });

	return unauthorized(
		{ error: error.code },
		{ headers: { "accept-signature": accept.data } },
	);
}
```

`created: true` asks the signer to include a creation time, and `tag` names the protocol the
signature is for. Each code names the
check that failed:

| `code`                                       | What it means                                               |
| -------------------------------------------- | ----------------------------------------------------------- |
| `unsigned`                                   | No signature, or none under the requested label             |
| `malformed`                                  | A signature field or component breaks its grammar           |
| `insufficient-coverage`                      | The method, target, host, a time or the digest is uncovered |
| `missing-component`, `unsupported-component` | A covered component is absent or cannot be derived          |
| `digest-mismatch`                            | The body is not the body that was signed                    |
| `stale-signature`                            | Too old, dated in the future, or past `expires`             |
| `key-unavailable`, `unsupported-algorithm`   | No key for the id, or a key of another algorithm            |
| `invalid-signature`                          | The signature does not verify                               |

A spike of `stale-signature` is usually a clock, not an attacker; `digest-mismatch` and
`invalid-signature` are worth an alert.

### Refuse a replay

`maxAge` bounds how long a signature is good for, and within that window the same request can
be sent again. A `nonce` closes it: remember each one for as long as a signature can be fresh,
and refuse one seen before. `verify` reports the verified label, and `parseSignatureInput` reads
that signature's parameters, `nonce` and `tag` among them:

```typescript {% title="app/services/signature-nonce.ts" %}
import type { Verified } from "@sdxc/http-signatures";

import { parseSignatureInput } from "@sdxc/http-signatures";
import { isFailure } from "@sdxc/result";
import { env } from "cloudflare:workers";

const NONCE_TTL_SECONDS = 15 * 60;

export async function claimNonce(request: Request, verified: Verified) {
	if (verified.label === null) return false;

	let inputs = parseSignatureInput(request.headers.get("signature-input") ?? "");
	if (isFailure(inputs)) return false;

	let params = inputs.data[verified.label]?.params;
	if (params?.tag !== "orders" || params.nonce === undefined) return false;

	let key = `nonce:${verified.keyId}:${params.nonce}`;
	if ((await env.NONCES.get(key)) !== null) return false;
	await env.NONCES.put(key, "1", { expirationTtl: NONCE_TTL_SECONDS });
	return true;
}
```

Call it right after `verify` succeeds, and answer `401` when it returns `false`. A draft-cavage
signature has no label, nonce or tag, so this endpoint accepts RFC 9421 alone. Fifteen minutes
covers the five-minute `maxAge` plus the clock skew on either side. KV is eventually consistent,
so two copies arriving within a second at different locations can both pass: the nonce narrows
the window, and an idempotent `saveOrder`, keyed on the order's own id, is what makes a repeat
harmless.

## Fall back to draft-cavage

Servers that predate RFC 9421, Mastodon before 4.5 among them, answer it with a `401`. Sign
with RFC 9421 first and, on a refusal, sign the same request again with
`scheme: "draft-cavage"`, which writes one `Signature` header with `algorithm="hs2019"` and a
legacy `Digest` instead of `Content-Digest`:

```typescript {% title="app/services/deliver.ts" %}
import type { Scheme, SigningKey } from "@sdxc/http-signatures";

import { sign } from "@sdxc/http-signatures";
import { isFailure, success } from "@sdxc/result";

const REFUSED = [400, 401, 403];

async function send(url: string, body: Uint8Array, key: SigningKey, scheme: Scheme) {
	let request = new Request(url, {
		method: "POST",
		headers: { "content-type": "application/activity+json" },
		body,
	});
	let signed = await sign(request, { scheme, key, body });
	if (isFailure(signed)) return signed;
	return success(await fetch(signed.data));
}

export async function deliver(url: string, body: Uint8Array, key: SigningKey) {
	let first = await send(url, body, key, "rfc9421");
	if (isFailure(first) || !REFUSED.includes(first.data.status)) return first;
	return await send(url, body, key, "draft-cavage");
}
```

Build a fresh `Request` for each attempt, since the first one's body was sent. The cavage
default covers `(request-target) host date digest content-type`, and `components` takes those
names plus `(created)` and `(expires)`. Remember which scheme each server accepted, and start
with it next time. [Federate a site with ActivityPub](/docs/content-and-feeds/activitypub) does
all of this for every delivery, and keeps the answer per server for thirty days.

On the receiving side nothing changes: `verify` accepts either scheme, and `verified.scheme`
says which arrived. An `hs2019` signature takes the key's own algorithm, and `rsa-sha256`
requires an RSA PKCS#1 v1.5 SHA-256 key.

## Read and write the signature fields

The fields themselves parse and serialize on their own, through the Structured Fields grammar,
for a proxy that inspects signatures or a test that builds one by hand:

- `parseSignatureInput` and `stringifySignatureInput` read `Signature-Input` as
  `Record<label, { components, params }>`. Parameter order survives the round trip, because the
  signature base serializes them as written, and `created` and `expires` read as `Date`.
- `parseSignature` and `stringifySignature` read `Signature` as `Record<label, Uint8Array>`.
- `parseAcceptSignature` and `stringifyAcceptSignature` read the requests a server sends, with
  `created` and `expires` as `true` when asked for.
- `parseCavageSignature` and `stringifyCavageSignature` read a draft-cavage header as
  `{ keyId, algorithm, created, expires, headers, signature }`; `headers` is `null` when the
  sender left the list out.

## Attach digests on their own

A digest alone proves the body arrived as it was sent; a signature over the digest proves who
sent it. The digest by itself still earns its place on a large download, an upload resumed in
parts, or a cached response, where corruption is the risk rather than forgery.

The fields name two different things. `Content-Digest` is the hash of the content of this
message, the exact bytes sent. `Repr-Digest` is the hash of the whole representation the URL
names, so a range response carrying part of a file still carries the digest of the complete
file, which the client checks once it holds every part. `Want-Content-Digest` and `Want-Repr-Digest` are how a client says
which algorithms it prefers, as weights from 0 to 10.

A download that answers in the algorithm the client weighs highest:

```typescript {% title="app/http/controllers/exports.ts" %}
import { DIGEST_ALGORITHMS, digest, parse, stringify } from "@sdxc/digest-fields";
import { isFailure, isSuccess } from "@sdxc/result";
import { createAction } from "remix/router";

import { buildExport } from "~/app/models/exports";
import routes from "~/routes/web";

function preferred(request: Request) {
	let header = request.headers.get("want-content-digest") ?? "";
	let wanted = parse(header, "want-content-digest");
	if (!isSuccess(wanted)) return "sha-256";

	let weights = wanted.data;
	let ranked = DIGEST_ALGORITHMS.filter((name) => (weights[name] ?? 0) > 0);
	ranked.sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0));
	return ranked[0] ?? "sha-256";
}

export default createAction(routes.exports.download, async (ctx) => {
	let body = new TextEncoder().encode(JSON.stringify(await buildExport(ctx.db)));
	let algorithm = preferred(ctx.request);

	let hashed = await digest(body, algorithm);
	if (isFailure(hashed)) return new Response(body);
	let field = stringify({ [algorithm]: hashed.data }, "content-digest");
	if (isFailure(field)) return new Response(body);

	return new Response(body, {
		headers: {
			"content-type": "application/json",
			"content-digest": field.data,
		},
	});
});
```

`digest` hashes with `sha-256` or `sha-512`; text is read as UTF-8, so pass the exact bytes sent
when they are not UTF-8 text. `stringify` writes `sha-256=:…:` for the RFC 9530 fields, and an
empty value answers `""`, which means "send no field". Both fields describe the bytes as
encoded, so compute them where the body is final: a layer that compresses or rewrites the
response afterwards changes what the digest describes. `"repr-digest"` writes `Repr-Digest` with
the same call.

Checking a body someone sent is one call. `verify` takes the headers, the bytes and the field:

```typescript {% title="app/http/controllers/uploads.ts" %}
import { verify } from "@sdxc/digest-fields";
import { badRequest, created } from "@sdxc/http/response/json";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { storeUpload } from "~/app/models/uploads";
import routes from "~/routes/web";

export default createAction(routes.uploads.create, async (ctx) => {
	let body = new Uint8Array(await ctx.request.arrayBuffer());

	let checked = await verify(ctx.request.headers, body, {
		field: "content-digest",
	});
	if (isFailure(checked)) return badRequest({ error: checked.error.code });

	let id = await storeUpload(ctx.db, body);
	return created({ id });
});
```

Every `sha-256` and `sha-512` entry the field carries must match, so a forged entry next to a
valid one still fails, and entries for algorithms the package does not compute are skipped. A
`DigestError` carries one `code`: `missing` (no such field), `malformed` (the text breaks the
grammar), `unsupported-algorithm` (no `sha-256` or `sha-512` entry to check), `mismatch` (the
body changed), `invalid` (`stringify` was given a name or weight the field cannot carry) or
`crypto` (the runtime refused the hash). Only `mismatch` says the content changed.

The legacy RFC 3230 `Digest` header, which draft-cavage signatures cover, goes through the same
functions with `"digest"`: `stringify` writes `SHA-256=…` with the uppercase names every cavage
verifier expects, and `parse` accepts any case and skips entries such as `UNIXsum=30637` whose
value is not base64.

## Where to go next

- [Federate a site with ActivityPub](/docs/content-and-feeds/activitypub) — signed delivery
  and a verified inbox, built on both packages.
- [Receive and send webhooks](/docs/identity-and-security/webhooks) — Standard Webhooks, the
  shared-secret signature most webhook senders use.
- [Hash, sign and encrypt with Web Crypto](/docs/identity-and-security/web-crypto) — the
  primitives under `Pem` and the digests.
- [`@sdxc/http-signatures`](/api/http-signatures) — every type, option and error code.
