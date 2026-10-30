---
title: Sign and verify HTTP requests
description: Sign requests with RFC 9421 or draft-cavage, verify them with a freshness window and replay checks, and attach and check Content-Digest and Repr-Digest.
section:
    title: Identity & security
    order: 6
order: 14
lastUpdated: 2026-10-25
outcomes:
    - "How to sign outgoing requests with RFC 9421 and draft-cavage"
    - "How to verify signatures with a freshness window and replay checks"
    - "How to attach and check `Content-Digest` and `Repr-Digest`"
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
older scheme much of the fediverse still speaks. [`@sdxc/digest-fields`](/api/digest-fields)
reads, writes and checks the [RFC 9530](https://www.rfc-editor.org/rfc/rfc9530)
`Content-Digest` and `Repr-Digest`, and every call answers a `Result` from
[`@sdxc/result`](/api/result).

```bash
npm add @sdxc/crypto @sdxc/digest-fields @sdxc/http @sdxc/http-signatures @sdxc/logger \
	@sdxc/outbound @sdxc/result @sdxc/uuid @sdxc/validate remix
```

## Make a key pair

Keys are Web Crypto `CryptoKey`s. Ed25519 is short and fast, and `sign` also takes RSA and
ECDSA P-256 keys, reading the algorithm from the key. Generate a pair once:

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
import { generateUUID } from "@sdxc/uuid/v4";

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
		nonce: generateUUID(),
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
another that trusts the same key.

To talk to a server that predates RFC 9421, Mastodon before 4.5 among them, sign a fresh
request with `scheme: "draft-cavage"`.
[Federate a site with ActivityPub](/docs/content-and-feeds/activitypub) falls back this way
for every delivery and remembers which scheme each server accepted.

## Verify the requests you receive

`verify` reads `Signature-Input` and selects RFC 9421, or reads `Signature` alone and selects
draft-cavage, so one endpoint accepts both. It checks coverage, the body digest and freshness
before it asks for a key, so a stale or incomplete request never costs a key lookup. The key
lookup is yours; here it reads the PEM a partner registered under its key id:

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

import { refuseSignature } from "~/app/http/controllers/refuse-signature";
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

> [!WARNING]
> Verify before anything else reads the request: a handler that acts on the body first acts on
> a request nobody has proven.

> [!NOTE]
> A partner's server has no session and no `Origin` header, so when your app runs Remix's
> [`cop()`](https://github.com/remix-run/remix/tree/main/packages/cop-middleware), exempt the
> signed paths from it.

### Refuse in a way the caller can act on

Every failure is an `HttpSignatureError` whose `code` names the check, such as
`digest-mismatch` or `stale-signature`. All of them mean the request is not proven, so all
answer `401`. `Accept-Signature` (RFC 9421 §5.1) says which signature you would accept, so a
caller that signed too little learns what to cover:

```typescript {% title="app/http/controllers/refuse-signature.ts" %}
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

A spike of `stale-signature` is usually a clock, not an attacker; `digest-mismatch` and
`invalid-signature` are worth an alert.

### Refuse a replay

`maxAge` bounds how long a signature is good for, and within that window the same request can
be sent again. A `nonce` closes it: remember each one for as long as a signature can be fresh,
and refuse one seen before. `parseSignatureInput` reads the verified signature's parameters,
`nonce` and `tag` among them:

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
covers the five-minute `maxAge` plus the clock skew on either side.

> [!WARNING]
> KV is eventually consistent, so two copies arriving within a second at different locations can
> both pass. The nonce narrows the window, and an idempotent `saveOrder`, keyed on the order's own
> id, is what makes a repeat harmless.

## Attach digests on their own

A digest alone proves the body arrived as it was sent; a signature over the digest proves who
sent it. A digest by itself earns its place on a large download, an upload resumed in parts,
or a cached response, where corruption is the risk rather than forgery. `Content-Digest` is
the hash of the exact bytes of this message:

```typescript {% title="app/http/controllers/exports.ts" %}
import { digest, stringify } from "@sdxc/digest-fields";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { buildExport } from "~/app/models/exports";
import routes from "~/routes/web";

export default createAction(routes.exports.download, async (ctx) => {
	let body = new TextEncoder().encode(JSON.stringify(await buildExport(ctx.db)));

	let hashed = await digest(body, "sha-256");
	if (isFailure(hashed)) return new Response(body);
	let field = stringify({ "sha-256": hashed.data }, "content-digest");
	if (isFailure(field)) return new Response(body);

	return new Response(body, {
		headers: {
			"content-type": "application/json",
			"content-digest": field.data,
		},
	});
});
```

`"repr-digest"` writes `Repr-Digest` with the same call, the hash of the whole representation
the URL names, which a range response carries for the complete file.

> [!NOTE]
> Both fields describe the bytes as encoded, so compute them where the body is final: a layer
> that compresses or rewrites the response afterwards changes what the digest describes. When a
> proxy or CDN compresses for you, send `"unencoded-digest"` instead, the hash of the
> representation before any `Content-Encoding`, which holds whatever coding is applied on the way.

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
valid one still fails. Of the `DigestError` codes, only `mismatch` says the content changed.

## Identify your bot with Web Bot Auth

A crawler, a feed reader or an uptime probe calls origins it has no relationship with, so there
is no key to exchange ahead of time.
[Web Bot Auth](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/) solves
that with an RFC 9421 profile: the bot signs every request under `tag="web-bot-auth"`, names its
own origin in a `Signature-Agent` header, and publishes its public keys at
`/.well-known/http-message-signatures-directory` there, so any origin can verify the request
and attribute it to that URL rather than to a User-Agent string anyone can copy.

Keep the bot's key as a private JWK in a Worker secret, imported once per isolate:

```typescript {% title="app/initializers/web-bot-auth.ts" %}
import type { WebBotAuthKey } from "@sdxc/http-signatures/web-bot-auth";

import {
	importWebBotAuthKey,
	webBotAuthSigner,
} from "@sdxc/http-signatures/web-bot-auth";
import { isFailure } from "@sdxc/result";
import { env } from "cloudflare:workers";

const IMPORTED = new Map<string, Promise<WebBotAuthKey | null>>();

export function webBotAuthKey(): Promise<WebBotAuthKey | null> {
	let imported =
		IMPORTED.get(env.WEB_BOT_AUTH_KEY) ??
		importWebBotAuthKey(JSON.parse(env.WEB_BOT_AUTH_KEY)).then((key) =>
			isFailure(key) ? null : key.data,
		);
	IMPORTED.set(env.WEB_BOT_AUTH_KEY, imported);
	return imported;
}

export async function requestSigner() {
	let key = await webBotAuthKey();
	return key
		? webBotAuthSigner({ key, agent: "https://bot.example.com" })
		: undefined;
}
```

The signer covers `@authority`, `@method`, `@path` and its own `Signature-Agent` member,
valid for five minutes. Hand it to `follow` from [`@sdxc/outbound`](/api/outbound), and every
hop of a redirect chain is signed for its own authority:

```typescript
let followed = await follow(url, {
	timeout: "10 seconds",
	sign: await requestSigner(),
});
```

Publish the directory with [`@sdxc/well-known`](/api/well-known)'s
`httpMessageSignaturesDirectory`, and pass `signDirectoryResponse` as its `sign` option so each
key signs the response over the request's authority, and the key set cannot be re-served under
another origin.

On the receiving side, `verifyWebBotAuth` checks the profile, fetches and caches the directory
the `Signature-Agent` names, and answers that directory's URL as `agent`, the identifier to
allowlist or rate limit.

## Test both ends

A signature is checked end to end by signing a request with a key made in the test and
verifying it with the public half. The router test proves the endpoint refuses an unsigned
call before it looks up a key or reads the body:

```typescript {% title="app/http/controllers/orders.test.ts" %}
import { sign, verify } from "@sdxc/http-signatures";
import { isFailure, isSuccess, success, unwrap } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";
import { expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import routes from "~/routes/web";

const KEY_ID = "https://api.example.com/keys/1";

test("a signed order verifies, and a changed body fails", async () => {
	let keys = (await crypto.subtle.generateKey({ name: "Ed25519" }, false, [
		"sign",
		"verify",
	])) as CryptoKeyPair;
	let body = new TextEncoder().encode(JSON.stringify({ id: "o1", total: 10 }));
	let request = new Request("https://partner.example.com/orders", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body,
	});
	let signed = unwrap(
		await sign(request, {
			scheme: "rfc9421",
			key: { id: KEY_ID, privateKey: keys.privateKey },
			body,
			nonce: generateUUID(),
			tag: "orders",
		}),
	);
	let key = async (keyId: string) =>
		success(keyId === KEY_ID ? keys.publicKey : null);

	let verified = await verify(signed, { key, maxAge: "5 minutes" });
	expect(isSuccess(verified) && verified.data.keyId).toBe(KEY_ID);

	let tampered = new Request(signed, {
		body: JSON.stringify({ id: "o1", total: 0 }),
	});
	let refused = await verify(tampered, { key, maxAge: "5 minutes" });
	expect(isFailure(refused) && refused.error.code).toBe("digest-mismatch");
});

test("an unsigned order is told what to sign", async () => {
	let response = await createWebRouter().fetch(
		new Request(new URL(routes.orders.create.href(), "https://example.com"), {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ id: "o1", total: 10 }),
		}),
	);

	expect(response.status).toBe(401);
	expect(response.headers.get("accept-signature")).toContain('tag="orders"');
});
```

## Where to go next

- [Federate a site with ActivityPub](/docs/content-and-feeds/activitypub) — signed delivery
  and a verified inbox, built on both packages.
- [Receive and send webhooks](/docs/identity-and-security/webhooks) — Standard Webhooks, the
  shared-secret signature most webhook senders use.
- [Fetch URLs a stranger chose](/docs/identity-and-security/fetch-untrusted-urls) — the
  checked walk Web Bot Auth signs and fetches directories through.
- [`@sdxc/http-signatures`](/api/http-signatures) — every type, option and error code.
