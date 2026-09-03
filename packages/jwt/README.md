# @sdxc/jwt

JWT payload classes and the ES256, RS256 and EdDSA keys that sign them.

## Overview

A decoded JWT is a bag of `unknown`. Reading claims off it directly scatters the same string literals and the same type checks over every call site, and nothing stops one of them from trusting `payload.email` on a token whose issuer never sends that claim.

This package models a kind of token as a class instead. `JWT` carries the registered claims as typed accessors; an application subclasses it, narrows the accessors its tokens guarantee, and adds the ones it carries beyond the registered set — each one a single type-checked read against the claim set. Verifying through that subclass returns an instance of it, so the claims a handler reads and the claims the token class declares are the same list.

`JWK` covers the other half: generating a key pair, serializing it so it survives in a bucket or a database row, importing it back into `CryptoKey` objects, publishing the public half as a JWKS, and turning someone else's JWKS — held locally or fetched — into the resolver a token is verified through.

An object model over JWT claim sets and the keys that sign them, then, sitting on top of a JOSE implementation that does the signing and verifying itself.

## Usage

### Describing A Kind Of Token

```typescript
import { JWT } from "@sdxc/jwt";

export default class IdToken extends JWT {
	// Narrowed: this token always carries `sub`, so the accessor is `string`, not
	// `string | null`.
	override get subject() {
		return this.parser.string("sub");
	}

	get email() {
		return this.parser.string("email");
	}

	get emailVerified() {
		return this.parser.boolean("email_verified");
	}
}
```

### Issuing A Token

```typescript
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

### Verifying One

```typescript
import { JWK } from "@sdxc/jwt";

// Hold this for the life of the isolate: it caches the fetched key set.
let keys = JWK.importRemote(new URL(jwksUrl));

let idToken = await IdToken.verify(rawToken, await keys, {
	issuer: "https://auth.example.com",
	audience: clientId,
	algorithms: [JWK.Algorithm.ES256],
	clockTolerance: 60,
});

idToken.subject; // "user-123"
idToken.email; // "ada@example.com"
```

### Publishing The Key Set

```typescript
import { JWK } from "@sdxc/jwt";

let keys = await JWK.signingKeys(storage);

return Response.json(JWK.toJSON(keys), {
	headers: { "Cache-Control": "public, max-age=3600" },
});
```

## API

### `JWT`

A JWT claim set with the registered claims exposed as accessors. Meant to be subclassed; usable directly when a token needs no accessors of its own.

#### `new JWT(payload?: JWT.PayloadInput)`

Wraps a claim set.

**Parameters:**

- `payload`: The claims, defaulting to `{}` so a token can be built up through the setters

`exp`, `iat`, and `nbf` accept a length of time as well as a number. Written as text, the claim is that long from the moment the token is built; written as a number, it is the seconds since the epoch and is used as given. Either way `payload` holds the resolved seconds, so the rest of the class, signing, and verification all see one form.

```typescript
new JWT({ sub: "user-123", iat: "0s", exp: "1h" });
new JWT({ sub: "user-123", exp: Math.floor(Date.now() / 1000) + 3600 }); // the same token
```

Instances are proxied: a claim with no accessor is still readable by name and returns `null` when absent, and assigning an unknown property writes it into the payload so it is carried into the signature.

**Example:**

```typescript
let jwt = new JWT({ sub: "user-123", scope: "read" });
jwt.subject; // "user-123"
jwt.scope; // "read" — no accessor declared, read through the payload
jwt.missing; // null
```

#### `jwt.payload`

The raw claim set, readable whole. This is the same object the accessors read through, so a caller that wants the claim bag and a subclass that wants typed accessors can use the same instance.

#### `jwt.parser`

Protected. Type-checked reads over `payload`, for the accessors a subclass defines: `string`, `number`, `boolean`, `object`, and `has`. Each read throws when the claim is missing or holds the wrong type — see [Errors](#errors).

#### Registered Claim Accessors

| Accessor         | Claim | Type                         | Writable |
| ---------------- | ----- | ---------------------------- | -------- |
| `audience`       | `aud` | `string \| string[] \| null` | yes      |
| `expirationTime` | `exp` | `number \| null`             | yes      |
| `expiresIn`      | `exp` | `number \| null`             | no       |
| `expiresAt`      | `exp` | `Date \| null`               | no       |
| `expired`        | `exp` | `boolean`                    | no       |
| `issuedAt`       | `iat` | `Date \| null`               | yes      |
| `issuer`         | `iss` | `string \| null`             | yes      |
| `id`             | `jti` | `string \| null`             | yes      |
| `notBefore`      | `nbf` | `Date \| null`               | yes      |
| `subject`        | `sub` | `string \| null`             | yes      |

Every accessor answers `null` for a claim that is absent, so reading one never throws on a token that simply does not carry it. The setters take `null` to drop the claim, and convert `Date` values to the epoch seconds the RFC defines.

`expiresIn` counts the seconds left before `exp` and goes negative once it has passed, and `expired` follows from it. Both read `exp` in the seconds RFC 7519 defines, which is what `JWT.verify` enforces expiry against.

#### `jwt.sign(algorithm: JWK.Algorithm, jwks: JWK.SigningKey[]): Promise<string>`

Signs this token with the first key in the set matching the algorithm, writing that key's `kid` into the header.

**Returns:**

- The compact-serialized token

Throws when no key in the set was generated for that algorithm.

#### `jwt.toJSON(): Record<string, unknown>`

The claims a subclass exposes, as a plain object. Reads the getters declared directly on the instance's own prototype, so the result is the subclass's view of the token: the claims it models.

#### `JWT.sign(jwt: JWT, algorithm: JWK.Algorithm, jwks: JWK.SigningKey[]): Promise<string>`

The static form of `jwt.sign`, for signing a token you were handed.

#### `JWT.verify(token: string, jwks: JWK.VerificationKeys, options?: JWT.VerifyOptions): Promise<JWT>`

Verifies a token and returns it as an instance of the class the method was called on.

**Parameters:**

- `token`: The compact-serialized token
- `jwks`: The keys themselves, or a resolver from `JWK.importLocal` / `JWK.importRemote`
- `options`: `issuer`, `audience`, `algorithms`, `clockTolerance`, and the rest of `JWT.VerifyOptions`

**Returns:**

- The verified token, typed as the class this was called on

Signature, `exp`, `nbf`, and whichever of `issuer` and `audience` are given are all checked, and the first failure throws — so reaching the return value means the claims are trustworthy.

The key is chosen per token, from the header the token carries: the key whose `kid` the header names is the one used, narrowed further by key type, curve, algorithm and intended use. A set that offers exactly one key for what the token asks for verifies it; a set that offers none, or several the token gives no way to choose between, is an error. Deciding per token is what lets an issuer publish several keys at once — during a rotation the retired key stays published and the tokens it signed keep verifying, while new tokens name the new key and get it.

Pass `algorithms`, listing the ones the caller expects. It is the pin that keeps a token naming one algorithm from being answered with a key published for another, once a set carries keys for more than one.

**Example:**

```typescript
let idToken = await IdToken.verify(raw, keys, {
	issuer,
	audience: clientId,
	algorithms: [JWK.Algorithm.ES256],
});
```

#### `JWT.decode(token: string): JWT`

Reads a token's claims without checking anything, as an instance of the class this was called on.

What comes back is the token's own account of itself, read without any check. Use it to decide how to verify a token — reading `iss` to pick a JWKS, for instance — and let `verify` be what every decision about the request rests on.

#### `JWT.Payload`

```typescript
type Payload = jose.JWTPayload;
```

#### `JWT.VerifyOptions`

```typescript
type VerifyOptions = jose.JWTVerifyOptions;
```

### `JWK`

#### `JWK.Algorithm`

The supported signature algorithms.

```typescript
JWK.Algorithm.ES256; // "ES256"
JWK.Algorithm.RS256; // "RS256"
JWK.Algorithm.EdDSA; // "EdDSA"
```

| Algorithm | `kty` | Reach for it when                                         |
| --------- | ----- | --------------------------------------------------------- |
| `ES256`   | `EC`  | Signing here; it is what a bootstrapped key is minted for |
| `RS256`   | `RSA` | Verifying an upstream identity provider's tokens          |
| `EdDSA`   | `OKP` | Signing, where a deterministic nonce is wanted            |

`RS256` earns its place on the verifying side: an upstream identity provider signs with what it chooses, and that is commonly `RS256`. `EdDSA` derives each signature's nonce from the key and the message rather than drawing a fresh one, which puts the nonce reuse that recovers an ECDSA private key out of reach.

The names are also importable on their own, for a caller that needs to read or list them without the key machinery behind them:

```typescript
import * as Algorithm from "@sdxc/jwt/algorithm";

Object.values(Algorithm); // ["ES256", "RS256", "EdDSA"]
```

```typescript
import { ES256 } from "@sdxc/jwt/algorithm";
```

That entry point holds the three constants and nothing else, so importing it costs nothing beyond the names.

All three coexist in one key set. Verification picks a key by the `kid` and the algorithm a token names, so a set publishing several resolves the same way a set of one does.

#### `JWK.generateKeyPair(alg: JWK.Algorithm): Promise<JWK.SerializedKeyPair>`

Generates a new key pair in serialized form: PEM strings and a millisecond timestamp, so the whole pair survives `JSON.stringify` into a bucket or a text column.

Keys are generated extractable on purpose. A pair that cannot be exported cannot be stored, and a signing key that only exists in one isolate signs tokens no other isolate can verify.

#### `JWK.importKeyPair(value: JWK.SerializedKeyPair): Promise<JWK.KeyPair>`

Imports a stored pair back into usable `CryptoKey` objects, and attaches the public half as a JWK stamped with `kid` and `use: "sig"`.

Stamping happens here rather than at publish time, so the identifier a token header carries and the identifier the JWKS advertises cannot drift apart.

**Example:**

```typescript
let pair = await JWK.importKeyPair({
	id: record.id,
	alg: JWK.Algorithm.ES256,
	publicKey: record.public_key,
	privateKey: record.private_key,
	created: new Date(record.created_at).getTime(),
});
```

#### `JWK.signingKeys(storage: KeyStorage): Promise<JWK.KeyPair[]>`

Loads every signing key out of storage, generating one on first use. Newest first, which is the order `sign` relies on to pick what to sign with and the order `toJSON` publishes them in. A set holding several is the normal state during a rotation: the newest signs, the older ones stay published so the tokens they signed keep verifying. A new ES256 key is minted when nothing usable is stored at all.

Generation time is the whole ordering, so a store holding keys for several algorithms comes back as one sequence and `sign` takes the newest key generated for the algorithm it was asked for.

Point this at the bucket the issuer already keeps its keys in. Against an empty one it bootstraps a key, and tokens signed with it verify once every relying party has refreshed its copy of the published set.

#### `JWK.importLocal(jwks: jose.JSONWebKeySet): Promise<JWK.KeyResolver>`

Turns a key set that is already in hand into a resolver `JWT.verify` can use.

#### `JWK.importRemote(url: URL, options?: JWK.RemoteOptions): Promise<JWK.KeyResolver>`

Points a resolver at a JWKS endpoint. The document is fetched when a token first needs it, then held — so hold the resolver for the life of the isolate, and every verification shares one fetched key set.

The held copy is fetched again, at most once per cooldown window, when a token names a `kid` it does not carry. That is what carries a verifier across a rotation between deploys: the first token signed by a newly published key is what pulls that key in.

Both resolve per token rather than up front, because which key a token needs is what the token itself says. `JWT.verify` describes the selection that follows.

#### `JWK.toJSON(keys: JWK.KeyPair[]): jose.JSONWebKeySet`

Renders key pairs as the JSON a `/.well-known/jwks.json` endpoint serves. Every entry is built out of the parameters its key type publishes, drawn only from the public half, alongside the `kid` and `alg` a relying party selects on:

| `kty` | Published entry                      |
| ----- | ------------------------------------ |
| `EC`  | `crv`, `x`, `y`, `kty`, `kid`, `alg` |
| `OKP` | `crv`, `x`, `kty`, `kid`, `alg`      |
| `RSA` | `e`, `n`, `kty`, `kid`, `alg`        |

The shape of the output is what guarantees a private key cannot reach the endpoint through a field nobody thought about: `d` on any of them, and `p`, `q`, `dp`, `dq` and `qi` on an RSA key besides. A key type absent from that table is one whose private parameters have never been enumerated, so it **throws** rather than publishing an entry nobody has vetted — and it throws for the document as a whole, so the rest of the set does not go out alongside an entry a relying party cannot use.

`alg` is published because a set carrying more than one algorithm gives a relying party nothing else to select on before it reaches the signature.

#### Types

```typescript
interface KeyPair {
	id: string;
	alg: Algorithm;
	public: jose.CryptoKey;
	private: jose.CryptoKey;
	created: Date;
	expired?: Date;
	jwk: jose.JWK;
}

interface SerializedKeyPair {
	id: `${string}-${string}-${string}-${string}-${string}`;
	alg: Algorithm;
	publicKey: string; // SPKI PEM
	privateKey: string; // PKCS#8 PEM
	created: number; // epoch milliseconds
	expired?: Date;
}

interface SigningKey {
	id: string;
	alg: string;
	private: jose.CryptoKey;
}

interface VerificationKey {
	jwk: jose.JWK; // the published key, carrying the `kid` a token names
}

type KeyResolver = jose.JWTVerifyGetKey; // answers with the key a token calls for
type VerificationKeys = KeyResolver | VerificationKey[];
type RemoteOptions = jose.RemoteJWKSetOptions;
```

`KeyPair` satisfies both `SigningKey` and `VerificationKey`, so a full pair is accepted anywhere either is.

### `KeyStorage`

The storage contract `JWK.signingKeys` is written against, and nothing more.

```typescript
interface KeyStorage {
	get(key: string): File | null | Promise<File | null>;
	list(options?: KeyStorageListOptions): KeyStorageListResult | Promise<KeyStorageListResult>;
	set(key: string, file: File): void | Promise<void>;
}
```

Three operations, each allowed to be synchronous or to return a promise — which is what lets a plain in-memory object satisfy it in a test while a bucket client satisfies it in production. Any object store that pages by prefix with an opaque cursor fits without an adapter.

Reading, listing and writing are the whole contract: a key is written once and kept, so that every token it ever signed stays verifiable.

### Errors

Claim reads through `this.parser` **throw** rather than returning a `Result`, which is a deliberate departure from the rest of this monorepo. The reads happen inside property getters, and a getter has no room for a `Result` without changing the type of every claim accessor in every token class and forcing each call site to unwrap a value that has already been through signature verification.

| Error              | Raised when                                             |
| ------------------ | ------------------------------------------------------- |
| `ParserError`      | Base class for both                                     |
| `MissingKeyError`  | A claim an accessor requires is absent from the payload |
| `InvalidTypeError` | A claim is present but holds the wrong JSON type        |

These classes are internal — a caller catches them by name (`ParserMissingKeyError`, `ParserInvalidTypeError`) or, more usually, does not catch them at all: a claim missing from a token that has already verified means the issuer sent something the token class does not model, which is closer to a bug than to a runtime condition worth branching on.

`boolean` is strict. The string `"true"` is a type error, not a `true` — silently coercing it would turn an identity provider's malformed `email_verified` into a trusted `true`.

## Rotation, And The Order To Roll It Out In

A rotation adds a key. The issuer writes a new pair into storage, `signingKeys` returns it first, `sign` picks it because it is the newest, and the retired key stays in the published JWKS so that the tokens it already signed keep verifying until they expire. Keys are kept, which is what makes that possible.

That rests on every verifier being able to pick a key by `kid`, which makes the rollout order a **deployment constraint as much as a code one**. Issuer and verifiers are deployed separately, so:

1. Deploy the verifiers first — everything that verifies tokens against the published set — and confirm they are live on a version that resolves a key per token.
2. Then let the issuer publish more than one key.

In that order every verifier can already tell two published keys apart on the day a second one appears. A verifier still on a version that resolves a single key up front has no way to choose between them, and it is every verification it does that stops, not a few.

A verifier picks a newly published key up when a token first names it, so keep a retired key published for at least as long as the tokens it signed can live.

## Pattern: Verifying An Upstream ID Token

Resolve the key set once, at module scope or in a container singleton, and treat any failure — an unreachable JWKS, a bad signature, a wrong issuer — as the same "not authenticated" outcome.

Pin `algorithms` to what the provider actually signs with, which is usually `RS256`. It is the provider's choice, not yours, so read its discovery document rather than assuming.

```typescript
let verificationKey = JWK.importRemote(new URL(jwksUrl));

export async function verify(raw: string) {
	try {
		return await IdToken.verify(raw, await verificationKey, {
			issuer: "https://auth.example.com",
			audience: clientId,
			algorithms: [JWK.Algorithm.RS256],
			clockTolerance: 60,
		});
	} catch {
		return null;
	}
}
```

Wrap the accessor reads in the same `try` when the caller reads claims the issuer treats as optional: those throw from the getter itself.

## Pattern: Keys In A Database Instead Of A Bucket

`signingKeys` is a convenience over one particular storage shape. When keys live in rows, drive `generateKeyPair`/`importKeyPair` directly — they are the whole contract.

```typescript
let serialized = await JWK.generateKeyPair(JWK.Algorithm.ES256);

await db.create(table, {
	id: serialized.id,
	public_key: serialized.publicKey,
	private_key: serialized.privateKey,
	created_at: new Date(serialized.created).toISOString(),
});

let pair = await JWK.importKeyPair(serialized);
```

Importing is not free — cache the resulting `KeyPair[]` for the life of a request at minimum, and key that cache per tenant if one isolate serves several.

## Related Packages

- [`@sdxc/crypto`](/packages/crypto) - WebCrypto primitives for the secrets that are not tokens: password hashing, HMAC, sealed storage
- [`@sdxc/oidc-provider`](/packages/oidc-provider) - OIDC/OAuth2 provider engine, whose token value objects are built on `JWT`

## Tips

1. **Subclass per kind of token** - one class per token type, with an accessor for every claim it guarantees, is what keeps claim names out of handlers.
2. **Narrow the accessors you override** - a token that always carries `sub` should expose `string`, not `string | null`; that is the difference between one check and one at every call site.
3. **Resolve a remote JWKS once** - the resolver holds the fetched key set. Hold it in a container singleton or at module scope, so every request shares one.
4. **Route with `decode`, decide with `verify`** - what `decode` returns is the token's own account of itself, read without any check.
5. **Always pass `issuer` and `audience` to `verify`** - a valid signature from the right issuer for the wrong audience is still someone else's token.
6. **Give `clockTolerance` a value** - a small window (60 seconds is typical) absorbs drift between the issuer and the verifier without meaningfully extending a token's life.
7. **Use `expired` for display, not for access control** - it reports what the claim says, while `verify` is what rejects a token on it.
8. **Roll a rotation out verifier-first** - see [the ordering above](#rotation-and-the-order-to-roll-it-out-in); every verifier resolves a key per token before the issuer publishes a second one.
9. **Guard optional claims with `has`** - the typed reads throw, and `has` is the only cheap way to ask first.
10. **Point `signingKeys` at the bucket that already holds the keys** - against an empty one it bootstraps a fresh key, which verifies once every verifier has refreshed its copy of the published set.
11. **Pin `algorithms` to what the signer uses, not to what you issue** - `RS256` for an upstream identity provider, `ES256` or `EdDSA` for a token minted here.
