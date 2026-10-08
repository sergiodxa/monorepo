---
title: Issue and verify JWTs
description: Sign short-lived tokens with keys kept in R2, publish them as a JWKS, verify tokens by issuer and audience, and rotate keys safely.
section:
    title: Identity & security
    order: 5
order: 6
lastUpdated: 2026-10-08
---

A JSON Web Token lets one service vouch for a caller to another without either calling back.
This guide has your app sign short-lived tokens for requests it makes to a second service, a
reports API, then publish its public keys so that service verifies each token on its own. It
ends with rotating the signing key without breaking a single token in flight.

[`@sdxc/jwt`](/api/jwt) models tokens as classes and manages the ES256, RS256 and EdDSA keys
that sign them. [`@sdxc/well-known`](/api/well-known) serves the key set at
`/.well-known/jwks.json`, [`@sdxc/http`](/api/http) answers the refusals, and
[`@sdxc/result`](/api/result) turns a failed verification into a value.

```bash
npm add @sdxc/jwt @sdxc/well-known @sdxc/http @sdxc/result
```

## Describe the token

A verified token is a bag of claims until you say what it carries. Subclass `JWT` and give
each claim your token guarantees a typed accessor, read through `this.parser`:

```typescript {% title="app/auth/service-token.ts" %}
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
absent: `issuer`, `subject`, `audience`, `id`, `expiresAt` and the rest. Overriding `subject`
narrows it to `string`, because every token this app issues is about a user. The parser's reads
throw on a missing claim or one of the wrong JSON type, rather than coercing, so ask `has`
first for an optional one, as `scopes` does. `verify` and `decode` return an instance of the
class you call them on, so `ServiceToken.verify(…)` hands back these accessors.

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

Each key is written with its file name and type, so a read hands back the `File` that was
stored, and a listing carries R2's cursor only while more pages remain, which is how
`signingKeys` knows the walk is over. The bucket is typed by the three methods the storage
calls, so any `R2Bucket` binding fits. A `FileStorage` from `remix/file-storage` satisfies the
same contract, so a test can pass `createMemoryFileStorage()` instead of a bucket.

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

Caching the promise means concurrent requests share one read, and a failed read is dropped so
the next request tries again. On an empty bucket, `signingKeys` generates an ES256 pair, writes
it back and returns it, so the first deploy needs no setup. The keys come back newest first,
which is the order signing picks from.

## Sign a token

A token for another service names who issued it, who it is about, who it is for and when it
stops being valid. `exp`, `iat` and `nbf` take a duration measured from the moment the token is
built, so the lifetime reads as what it is:

```typescript {% title="app/services/reports.ts" %}
import { JWK } from "@sdxc/jwt";
import { env } from "cloudflare:workers";

import { ServiceToken } from "~/app/auth/service-token";
import { signingKeys } from "~/app/services/signing-keys";

const REPORTS_API = "https://reports.example.com";

export async function requestReport(userId: string, invoiceIds: string[]) {
	let token = new ServiceToken({
		iss: env.APP_ORIGIN,
		sub: userId,
		aud: REPORTS_API,
		scope: "reports:write",
		jti: crypto.randomUUID(),
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

`sign` picks the first key generated for the algorithm, the newest, and writes its `kid` into
the token's header, which is how a verifier finds the matching public key. It throws when the
set holds no key for that algorithm. `scope` has no accessor on the base class, but the
constructor carries any claim you pass into the signature, and `ServiceToken.scopes` reads it
back on the other side.

Keep the lifetime short. A bearer token works for whoever holds it until it expires, and one
you mint per call never needs to outlive the call. Signing a fresh one each time is cheap.

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

Add `publishKeys` to your router's middleware. It answers `GET` and `HEAD` for that one path
with an `ETag` and a `304` for an unchanged set, and passes every other request on. Signing
and publishing read the same cache, so an isolate that has not yet seen a new key is still
publishing the set its own tokens verify against.

## Verify on the other side

The reports API resolves your key set from its URL, once, and keeps the resolver for the life
of the isolate. `JWK.importRemote` fetches the document when a token first needs it and fetches
it again, at most once per cooldown, when a token names a `kid` it has not seen, which is what
carries it across your key rotations:

```typescript {% title="app/auth/authenticate.ts" %}
import { JWK } from "@sdxc/jwt";
import { failure, wrap } from "@sdxc/result";

import { ServiceToken } from "~/app/auth/service-token";

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

`verify` checks the signature, then `exp` and `nbf`, then the `issuer` and `audience` you
name, and throws at the first failure; `wrap` makes that a `Result`. Each option closes a door.
`audience` stops a token minted for another service from being replayed here. `algorithms`
refuses a token that names any algorithm other than the one you expect. `requiredClaims` refuses
a token with no `exp` at all, which would otherwise never expire, and one with no `sub`, which
the narrowed `subject` accessor would throw on. `clockTolerance` allows 30 seconds of clock
drift between the two services.

The handler then decides what the verified token may do:

```typescript {% title="app/http/controllers/api/reports/create.ts" %}
import { accepted, forbidden, unauthorized } from "@sdxc/http/response/json";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { authenticate } from "~/app/auth/authenticate";
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

Every verification failure answers the same `401`: an expired token, a wrong audience and a
bad signature all mean the caller has to get a new token. The reason goes to your logs, never
to the caller. A valid token without the scope is a `403`, because a new token for the same
caller would not help.

When the same app signs and verifies, pass the key pairs instead of a resolver:
`ServiceToken.verify(raw, await signingKeys(), options)`. A `KeyPair` carries its public JWK,
and the key is still chosen by the token's `kid`.

## Expiry on the client side

`verify` is what enforces expiry. The accessors report what the claim says, which is what a
caller needs to decide when to fetch a new token it was handed. `JWT.decode(raw)` reads the
claims without verifying them, and on the result `expiresIn` is the seconds left, going
negative once `exp` has passed, `expired` follows from it and `expiresAt` is the moment as a
`Date`. Refreshing when `expiresIn` drops under a minute keeps a token from expiring
mid-request. Never let `decode` decide anything about a request you received: it trusts
whatever the token says.

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

`generateKeyPair` returns the pair as PEM strings with a UUID `id` that becomes the `kid`,
which is exactly the JSON `signingKeys` reads back. Within five minutes every isolate rereads
the bucket, and the first token signed with the new key sends each verifier back for the
updated set. Run it from a cron job, as in
[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron), or by hand when a key
may have leaked.

Keep a retired key published for at least as long as the tokens it signed can live. With
five-minute tokens that is short, but deleting it early fails every token still in flight. The
first time you publish more than one key, make sure every verifier resolves keys by `kid`, as
`importRemote` does, before the issuer starts signing with the new one.

## ID tokens are a different job

An OpenID Connect ID token is a JWT too, but trusting one takes more than a signature and an
audience: the nonce from your login request, the authorized party and, for some flows, the
access token hash. [Sign in with OpenID Connect](/docs/identity-and-security/sign-in-with-oidc)
does those checks through [`@sdxc/auth`](/api/auth), with `JWK.Algorithm` pinning what the
provider may sign with, so reach for it instead of `JWT.verify` whenever the token comes from a
login.

## Where to go next

- [Sign in with OpenID Connect](/docs/identity-and-security/sign-in-with-oidc): verified
  ID tokens and sessions from an identity provider.
- [Hash, sign and encrypt with Web Crypto](/docs/identity-and-security/web-crypto): opaque
  tokens and HMAC signatures, for when the receiver shares a secret with you.
- [Build a JSON API with problem details](/docs/http-apis/json-apis): answer the refusals as
  problem documents.
- [`@sdxc/jwt`](/api/jwt): every accessor, the `KeyStorage` contract and keys kept in a
  database.
