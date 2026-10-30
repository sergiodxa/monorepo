---
title: Issue and verify JWTs
description: Sign short-lived tokens with keys kept in R2, publish them as a JWKS, verify tokens by issuer and audience, and rotate keys safely.
section:
    title: Identity & security
    order: 6
order: 6
lastUpdated: 2026-10-25
outcomes:
    - "How to sign short-lived JWTs with `@sdxc/jwt` keys kept in R2"
    - "How to publish a JWKS and verify tokens by issuer and audience"
    - "How to rotate the signing key without breaking tokens in flight"
---

A JSON Web Token lets one service vouch for a caller to another without either calling back.
This guide has your app sign short-lived tokens for requests it makes to a second service, a
reports API, then publish its public keys so that service verifies each token on its own. It
ends with rotating the signing key without breaking a single token in flight.

[`@sdxc/jwt`](/api/jwt) models tokens as classes and manages the ES256, RS256 and Ed25519 keys
that sign them. [`@sdxc/well-known`](/api/well-known) serves the key set at
`/.well-known/jwks.json`, [`@sdxc/http`](/api/http) answers the refusals, and
[`@sdxc/result`](/api/result) turns a failed verification into a value.
[`@sdxc/uuid`](/api/uuid) gives each token its `jti`.

```bash
npm add @sdxc/http @sdxc/jwt @sdxc/result @sdxc/uuid @sdxc/well-known remix
```

## Describe the token

A verified token is a bag of claims until you say what it carries. Subclass `JWT` and give
each claim your token guarantees a typed accessor, read through `this.parser`:

```typescript {% title="app/services/auth/service-token.ts" %}
import { JWT } from "@sdxc/jwt";

export class ServiceToken extends JWT {
	override get subject() {
		return this.parser.string("sub");
	}

	get scopes(): string[] {
		if (!this.parser.has("scope")) return [];
		return this.parser.string("scope").split(" ");
	}
}
```

The registered claims already have accessors on `JWT`, answering `null` when a claim is
absent; overriding `subject` narrows it to `string`, because every token this app issues is
about a user. The parser's reads throw on a missing claim, so ask `has` first for an optional
one, as `scopes` does. `ServiceToken.verify(…)` hands back an instance with these accessors.

## Keep the signing keys in R2

Every isolate that signs must use the same keys, and they must outlive any one deploy, so they
live in storage. `JWK.signingKeys` reads them through the three-method `KeyStorage` contract,
and `createR2KeyStorage` from `@sdxc/jwt/r2` implements it over an R2 bucket binding:

```typescript {% title="app/services/key-storage.ts" %}
import { createR2KeyStorage } from "@sdxc/jwt/r2";
import { env } from "cloudflare:workers";

export function keyStorage() {
	return createR2KeyStorage(env.SIGNING_KEYS);
}
```

Reading the keys is a listing, a read per key and two imports per key, so hold the result for a
few minutes rather than repeating that on every request:

```typescript {% title="app/services/signing-keys.ts" %}
import { JWK } from "@sdxc/jwt";

import { keyStorage } from "~/app/services/key-storage";

const REREAD_AFTER_MS = 5 * 60 * 1000;

let cached: { keys: Promise<JWK.KeyPair[]>; readAt: number } | null = null;

export function signingKeys(): Promise<JWK.KeyPair[]> {
	if (cached === null || Date.now() - cached.readAt > REREAD_AFTER_MS) {
		let keys = JWK.signingKeys(keyStorage());
		cached = { keys, readAt: Date.now() };
		keys.catch(() => {
			if (cached?.keys === keys) cached = null;
		});
	}
	return cached.keys;
}
```

Concurrent requests share one read, and a failed read is dropped so the next request tries
again. On an empty bucket, `signingKeys` generates an ES256 pair and writes it back, so the
first deploy needs no setup.

## Sign a token

A token for another service names who issued it, who it is about, who it is for and when it
stops being valid. `exp`, `iat` and `nbf` take a duration measured from the moment the token is
built, so the lifetime reads as what it is:

```typescript {% title="app/services/reports.ts" %}
import { JWK } from "@sdxc/jwt";
import { generateUUID } from "@sdxc/uuid/v4";
import { env } from "cloudflare:workers";

import { ServiceToken } from "~/app/services/auth/service-token";
import { signingKeys } from "~/app/services/signing-keys";

const REPORTS_API = "https://reports.example.com";

export async function requestReport(userId: string, invoiceIds: string[]) {
	let token = new ServiceToken({
		iss: env.APP_ORIGIN,
		sub: userId,
		aud: REPORTS_API,
		scope: "reports:write",
		jti: generateUUID(),
		iat: "0s",
		exp: "5 minutes",
	});
	let signed = await token.sign(JWK.Algorithm.ES256, await signingKeys());

	return await fetch(new URL("/api/reports", REPORTS_API), {
		method: "POST",
		headers: { Authorization: `Bearer ${signed}` },
		body: JSON.stringify({ invoiceIds }),
	});
}
```

`sign` picks the newest key for the algorithm and writes its `kid` into the token's header,
which is how a verifier finds the matching public key. Any claim you pass, such as `scope`, is
carried into the signature.

> [!WARNING]
> Keep the lifetime short. A bearer token works for whoever holds it until it expires, and one
> you mint per call never needs to outlive the call. Signing a fresh one each time is cheap.

## Publish the key set

The reports API verifies with your public keys, so serve them where it expects them.
`JWK.toJSON` renders the key pairs as a JWKS document with only the public parameters of each
key, and `@sdxc/well-known` answers `/.well-known/jwks.json` with it:

```typescript {% title="app/http/middleware/publish-keys.ts" %}
import { JWK } from "@sdxc/jwt";
import { jwks } from "@sdxc/well-known/jwks";
import { serve, wellKnown } from "@sdxc/well-known/middleware";

import { signingKeys } from "~/app/services/signing-keys";

export const publishKeys = wellKnown({
	"jwks.json": serve(jwks, async () => JWK.toJSON(await signingKeys()), {
		cache: { visibility: "public", maxAge: "5 minutes" },
	}),
});
```

Add `publishKeys` to your router's middleware; it answers that one path and passes every
other request on. Signing and publishing read the same cache, so an isolate always publishes
the set its own tokens verify against.

## Verify on the other side

The reports API resolves your key set from its URL, once, and keeps the resolver for the life
of the isolate. `JWK.importRemote` fetches the document when a token first needs it and fetches
it again, at most once per cooldown, when a token names a `kid` it has not seen, which is what
carries it across your key rotations:

```typescript {% title="app/services/auth/authenticate.ts" %}
import { JWK } from "@sdxc/jwt";
import { failure, wrap } from "@sdxc/result";

import { ServiceToken } from "~/app/services/auth/service-token";

const ISSUER = "https://app.example.com";

const JWKS = JWK.importRemote(new URL("/.well-known/jwks.json", ISSUER));

export async function authenticate(request: Request) {
	let [scheme, raw] = (request.headers.get("Authorization") ?? "").split(" ");
	if (scheme !== "Bearer" || !raw) return failure(new Error("No bearer token"));

	return await wrap(async () =>
		ServiceToken.verify(raw, await JWKS, {
			issuer: ISSUER,
			audience: "https://reports.example.com",
			algorithms: [JWK.Algorithm.ES256],
			requiredClaims: ["exp", "sub"],
			clockTolerance: 30,
		}),
	);
}
```

`verify` checks the signature, the expiry, the `issuer` and the `audience`, and throws at the
first failure; `wrap` makes that a `Result`.

> [!WARNING]
> Pass every option shown here, because each one closes a door. `audience` stops a token minted
> for another service from being replayed here. `algorithms` refuses a token that names any
> algorithm other than the one you expect. `requiredClaims` refuses a token with no `exp` at all,
> which would otherwise never expire.

`clockTolerance` allows 30 seconds of clock drift between the two services. An OpenID Connect
ID token needs more checks than these, such as the login's nonce, so verify one through
[Sign in with OpenID Connect](/docs/identity-and-security/sign-in-with-oidc) instead.

The handler then decides what the verified token may do:

```typescript {% title="app/http/controllers/api/reports/create.ts" %}
import { accepted, forbidden, unauthorized } from "@sdxc/http/response/json";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { authenticate } from "~/app/services/auth/authenticate";
import routes from "~/routes/web";

export default createAction(routes.api.reports.create, async (ctx) => {
	let token = await authenticate(ctx.request);
	if (isFailure(token)) {
		ctx.log.warn("token.rejected", { reason: token.error.message });
		let headers = { "WWW-Authenticate": 'Bearer error="invalid_token"' };
		return unauthorized({ error: "invalid_token" }, { headers });
	}

	if (!token.data.scopes.includes("reports:write")) {
		return forbidden({ error: "insufficient_scope" });
	}

	return accepted({ requestedBy: token.data.subject });
});
```

Every verification failure answers the same `401`, with the reason in your logs and never in
the response. A valid token without the scope is a `403`, because a new token for the same
caller would not help.

## Rotate the key

Rotating adds a key rather than replacing one. Write a new pair into the bucket, under the
`signing:key:` prefix `signingKeys` lists, and it becomes the newest, so it signs from then on
while the old key stays in the published set:

```typescript {% title="app/services/rotate-signing-key.ts" %}
import { JWK } from "@sdxc/jwt";

import { keyStorage } from "~/app/services/key-storage";

export async function rotateSigningKey() {
	let pair = await JWK.generateKeyPair(JWK.Algorithm.ES256);
	let file = new File([JSON.stringify(pair)], `${pair.id}.json`, {
		type: "application/json",
	});
	await keyStorage().set(`signing:key:${pair.id}`, file);
}
```

Within five minutes every isolate rereads the bucket, and the first token signed with the new
key sends each verifier back for the updated set. Run it from a cron job, as in
[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron), or by hand when a key
may have leaked.

> [!WARNING]
> Keep a retired key published for at least as long as the tokens it signed can live. With
> five-minute tokens that is short, but deleting it early fails every token still in flight.

## Test the token end to end

Sign with a key pair made in the test and answer the key set with
[MSW](https://mswjs.io/), so the reports API's resolver fetches it exactly as it would in
production. The second case proves `audience` refuses a token minted for another service:

```typescript {% title="app/http/controllers/api/reports/create.test.ts" %}
import { JWK } from "@sdxc/jwt";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, beforeAll, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import { ServiceToken } from "~/app/services/auth/service-token";
import routes from "~/routes/web";

const ISSUER = "https://app.example.com";
const KEYS: JWK.KeyPair[] = [];

const server = setupServer(
	http.get(`${ISSUER}/.well-known/jwks.json`, () =>
		HttpResponse.json(JWK.toJSON(KEYS)),
	),
);

beforeAll(async () => {
	let pair = await JWK.generateKeyPair(JWK.Algorithm.ES256);
	KEYS.push(await JWK.importKeyPair(pair));
	server.listen({ onUnhandledRequest: "error" });
});
afterAll(() => server.close());

async function requestReport(audience: string) {
	let token = new ServiceToken({
		iss: ISSUER,
		sub: "user-1",
		aud: audience,
		scope: "reports:write",
		exp: "5 minutes",
	});
	let signed = await token.sign(JWK.Algorithm.ES256, KEYS);
	let url = new URL(
		routes.api.reports.create.href(),
		"https://reports.example.com",
	);
	return createWebRouter().fetch(
		new Request(url, {
			method: "POST",
			headers: { Authorization: `Bearer ${signed}` },
		}),
	);
}

test("a token for this API is accepted", async () => {
	let response = await requestReport("https://reports.example.com");

	expect(response.status).toBe(202);
	expect(await response.json()).toEqual({ requestedBy: "user-1" });
});

test("a token minted for another service is refused", async () => {
	let response = await requestReport("https://billing.example.com");

	expect(response.status).toBe(401);
});
```

## Where to go next

- [Sign in with OpenID Connect](/docs/identity-and-security/sign-in-with-oidc) — verified
  ID tokens and sessions from an identity provider.
- [Hash, sign and encrypt with Web Crypto](/docs/identity-and-security/web-crypto) — opaque
  tokens and HMAC signatures, for when the receiver shares a secret with you.
- [`@sdxc/jwt`](/api/jwt) — every accessor, the `KeyStorage` contract and keys kept in a
  database.
