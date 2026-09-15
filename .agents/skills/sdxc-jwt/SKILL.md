---
name: sdxc-jwt
description: "@sdxc/jwt gives you a subclassable JWT claim-set class with typed accessors for the registered claims, plus JWK key generation, storage, rotation, JWKS publishing and per-token key resolution for ES256, RS256 and EdDSA. Use when issuing or verifying tokens, serving /.well-known/jwks.json, verifying an upstream identity provider's ID token against a remote JWKS, or rotating signing keys."
---

# @sdxc/jwt

JWT payload classes and the keys that sign them. `JWT` wraps a claim set with typed accessors for the registered claims and is subclassed to add accessors for the claims a kind of token carries; `JWK` is everything about keys — `generateKeyPair`, `importKeyPair`, `signingKeys`, `importLocal`, `importRemote`, `toJSON`, and the `Algorithm` enum. `KeyStorage` is the small key/value contract `JWK.signingKeys` reads and writes through. Signing and verification run on `jose`, so it works on any runtime with Web Crypto.

Full API, options and examples: [packages/jwt/README.md](packages/jwt/README.md)

## When to reach for it

- An app issues its own tokens and needs somewhere to keep, rotate and publish the keys that sign them.
- A route has to serve `/.well-known/jwks.json` with the public halves and nothing private.
- An upstream identity provider's ID token has to be verified against its published JWKS, with issuer, audience and algorithms pinned.
- Claims are being read off a decoded payload with casts and `??` defaults, and each kind of token wants a class with real accessors instead.
- A signing key is being rotated and old tokens must keep verifying until they expire.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/jwt": "workspace:*" } }
```

```ts
import { JWK, JWT } from "@sdxc/jwt";

let keys = await JWK.signingKeys(storage);

let token = new JWT({
	iss: "https://auth.example.com",
	sub: user.id,
	aud: client.id,
	iat: "0s",
	exp: "1h",
});

let signed = await token.sign(JWK.Algorithm.ES256, keys);
```

```ts
import { JWK } from "@sdxc/jwt";

// Hold this for the life of the process: it caches the fetched key set.
let keys = await JWK.importRemote(new URL("https://auth.example.com/.well-known/jwks.json"));

let idToken = await IdToken.verify(rawToken, keys, {
	issuer: "https://auth.example.com",
	audience: clientId,
	algorithms: [JWK.Algorithm.ES256],
	clockTolerance: 60,
});
```

### Entry points

- `@sdxc/jwt` — `JWT`, `JWK`, the `KeyStorage` contract and their types.
- `@sdxc/jwt/algorithm` — the algorithm names alone, for a caller that lists or reads them without pulling in the key machinery.

## Suggestions

- Subclass `JWT` per kind of token and read claims through `this.parser` (`string`, `number`, `boolean`, `object`, `get`, `has`). Every read but `has` throws on a missing or wrong-typed claim rather than coercing, so ask with `has` first for an optional claim and keep those reads inside the same `try` as the verify.
- `exp`, `iat` and `nbf` accept a duration string as well as a number: `exp: "1h"` means an hour from when the token is built, and the payload holds the resolved seconds.
- Always pass `algorithms` to `verify` so a token naming one algorithm is only answered with a key published for it, and always hold the resolver from `importRemote` for the life of the process — it caches the fetched document and refetches at most once per cooldown when a token names an unknown `kid`.
- `expiresIn` and `expired` report what the claim says, which suits display and cache decisions; `JWT.verify` is what actually enforces expiry. `JWT.decode` is for deciding *how* to verify (reading `iss` to pick a key set), never for deciding anything about the request.
- Rotation has a deployment order: deploy verifiers that resolve a key per token first, then let the issuer publish more than one key, and keep a retired key published for at least as long as the tokens it signed can live.
- `JWK.signingKeys` is a convenience over one storage shape. When keys live in database rows, drive `generateKeyPair` and `importKeyPair` directly — those two are the whole contract — and cache the imported pairs, since each import loads two keys.

## Related

- `@sdxc/duration` — the duration strings the `exp`, `iat` and `nbf` claims accept; skill `sdxc-duration`
- `@sdxc/oidc-provider` — an OIDC server built on these payload classes and key sets; skill `sdxc-oidc-provider`
