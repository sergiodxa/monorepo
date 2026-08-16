# @pkg/jwt

JWT payload classes and the ES256 keys that sign them.

## Overview

A decoded JWT is a bag of `unknown`. Reading claims off it directly scatters the same string literals and the same type checks over every call site, and nothing stops one of them from trusting `payload.email` on a token whose issuer never sends that claim.

This package models a kind of token as a class instead. `JWT` carries the registered claims as typed accessors; an application subclasses it, narrows the accessors its tokens guarantee, and adds the ones it carries beyond the registered set — each one a single type-checked read against the claim set. Verifying through that subclass returns an instance of it, so the claims a handler reads and the claims the token class declares are the same list.

`JWK` covers the other half: generating an ES256 key pair, serializing it so it survives in a bucket or a database row, importing it back into `CryptoKey` objects, publishing the public half as a JWKS, and resolving someone else's JWKS — held locally or fetched — into a key to verify against.

Signing and verification are [jose](https://github.com/panva/jose)'s, deliberately. Everything here is the object model around it, not a second implementation of JWS.

## Usage

### Describing A Kind Of Token

```typescript
import { JWT } from "@pkg/jwt";

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
import { JWK, JWT } from "@pkg/jwt";

let keys = await JWK.signingKeys(storage);

let token = new JWT({
	iss: "https://auth.example.com",
	sub: user.id,
	aud: client.id,
	iat: Math.floor(Date.now() / 1000),
	exp: Math.floor(Date.now() / 1000) + 3600,
});

let signed = await token.sign(JWK.Algorithm.ES256, keys);
```

### Verifying One

```typescript
import { JWK } from "@pkg/jwt";

// Resolve once per isolate, not per request — this fetches.
let keys = JWK.importRemote(new URL(jwksUrl), { alg: JWK.Algorithm.ES256 });

let idToken = await IdToken.verify(rawToken, await keys, {
	issuer: "https://auth.example.com",
	audience: clientId,
	clockTolerance: 60,
});

idToken.subject; // "user-123"
idToken.email; // "ada@example.com"
```

### Publishing The Key Set

```typescript
import { JWK } from "@pkg/jwt";

let keys = await JWK.signingKeys(storage);

return Response.json(JWK.toJSON(keys), {
	headers: { "Cache-Control": "public, max-age=3600" },
});
```

## API

### `JWT`

A JWT claim set with the registered claims exposed as accessors. Meant to be subclassed; usable directly when a token needs no accessors of its own.

#### `new JWT(payload?: JWT.Payload)`

Wraps a claim set.

**Parameters:**

- `payload`: The claims, defaulting to `{}` so a token can be built up through the setters

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

`expiresIn`, `expiresAt`, and `expired` read `exp` as **milliseconds**, not the seconds RFC 7519 defines. That is a quirk of the implementation this package vendors, kept because the token classes that care already override `expiresIn`. Treat these three as display helpers; expiry is enforced by `JWT.verify`, which reads `exp` correctly.

#### `jwt.sign(algorithm: JWK.Algorithm, jwks: JWK.SigningKey[]): Promise<string>`

Signs this token with the first key in the set matching the algorithm, writing that key's `kid` into the header.

**Returns:**

- The compact-serialized token

Throws when no key in the set was generated for that algorithm.

#### `jwt.toJSON(): Record<string, unknown>`

The claims a subclass exposes, as a plain object. Reads the getters declared directly on the instance's own prototype, so the result is the subclass's view of the token — not the registered-claim accessors it inherited but may not use.

#### `JWT.sign(jwt: JWT, algorithm: JWK.Algorithm, jwks: JWK.SigningKey[]): Promise<string>`

The static form of `jwt.sign`, for signing a token you were handed.

#### `JWT.verify(token: string, jwks: JWK.VerificationKey[], options?: JWT.VerifyOptions): Promise<JWT>`

Verifies a token and returns it as an instance of the class the method was called on.

**Parameters:**

- `token`: The compact-serialized token
- `jwks`: Candidate verification keys; the first with a `public` key is used
- `options`: `issuer`, `audience`, `clockTolerance`, `algorithms`, and the rest of jose's `JWTVerifyOptions`

**Returns:**

- The verified token, typed as the class this was called on

Signature, `exp`, `nbf`, and whichever of `issuer` and `audience` are given are all checked, and any failure throws — so reaching the return value means the claims are trustworthy.

**Example:**

```typescript
let idToken = await IdToken.verify(raw, keys, { issuer, audience: clientId });
```

#### `JWT.decode(token: string): JWT`

Reads a token's claims without checking anything, as an instance of the class this was called on.

Nothing that comes back has been authenticated. Use it to look at a token before deciding how to verify it — reading `iss` to pick a JWKS, for instance — never to make a decision about a request.

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

The supported signature algorithms. ES256 only.

```typescript
JWK.Algorithm.ES256; // "ES256"
```

Adding an algorithm is not just a new entry here: a JWKS publishing more than one key needs `kid`-aware resolution on the verifying side, or a relying party cannot tell which key to use.

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

Loads the signing keys out of storage, generating one on first use. Newest first, which is the order `sign` relies on to pick what to sign with.

Never point this at an empty production bucket. It will happily generate a fresh key, and tokens signed with it verify against no relying party's cached JWKS.

#### `JWK.importLocal(jwks: jose.JSONWebKeySet, options?: { alg: JWK.Algorithm }): Promise<JWK.VerificationKey[]>`

Resolves a key set that is already in hand into a verification key.

#### `JWK.importRemote(url: URL, options: jose.RemoteJWKSetOptions & { alg: JWK.Algorithm }): Promise<JWK.VerificationKey[]>`

Fetches a JWKS endpoint and resolves it into a verification key. The fetch happens once, here — hold the result for the life of the isolate rather than calling this per request.

Both resolve a **single** key, matched on algorithm alone, at import time. The token's `kid` is never consulted, so a set publishing two keys for the same algorithm fails to resolve rather than picking one. See [Constraint: One Published Signing Key](#constraint-one-published-signing-key).

#### `JWK.toJSON(keys: JWK.KeyPair[])`

Renders key pairs as the JSON a `/.well-known/jwks.json` endpoint serves: `crv`, `kty`, `x`, `y`, and `kid`, taken only from the public half. The shape of the output is what guarantees a private key cannot reach the endpoint through a field nobody thought about.

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
	public: jose.CryptoKey;
}
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

Deliberately absent: `has`, `put`, and `remove`. This package never deletes a key, because a deleted key is one that already-issued tokens can no longer be verified against.

### Errors

Claim reads through `this.parser` **throw** rather than returning a `Result`, which is a deliberate departure from the rest of this monorepo. The reads happen inside property getters, and a getter has no room for a `Result` without changing the type of every claim accessor in every token class and forcing each call site to unwrap a value that has already been through signature verification.

| Error              | Raised when                                             |
| ------------------ | ------------------------------------------------------- |
| `ParserError`      | Base class for both                                     |
| `MissingKeyError`  | A claim an accessor requires is absent from the payload |
| `InvalidTypeError` | A claim is present but holds the wrong JSON type        |

These classes are internal — a caller catches them by name (`ParserMissingKeyError`, `ParserInvalidTypeError`) or, more usually, does not catch them at all: a claim missing from a token that has already verified means the issuer sent something the token class does not model, which is closer to a bug than to a runtime condition worth branching on.

`boolean` is strict. The string `"true"` is a type error, not a `true` — silently coercing it would turn an identity provider's malformed `email_verified` into a trusted `true`.

## Constraint: One Published Signing Key

`importLocal` and `importRemote` resolve a key set at import time, before any token is in hand, so they match on algorithm alone and have no `kid` to disambiguate with. A JWKS publishing two ES256 keys therefore fails to resolve at all, for every relying party.

`JWK.signingKeys` is built to that constraint, and its paging carries a quirk that enforces it: the first listed entry is never yielded, so a bucket bootstrapped from empty ends up holding two key files and reporting one. That is preserved on purpose. Correcting the paging on its own would start publishing both keys and break every consumer, so it has to be done together with kid-aware resolution and a deliberate migration.

Until then: **one key in the published set**. Rotation means replacing it, not adding to it, and it means a window in which tokens signed by the retired key stop verifying.

## Pattern: Verifying An Upstream ID Token

Resolve the key set once, at module scope or in a container singleton, and treat any failure — an unreachable JWKS, a bad signature, a wrong issuer — as the same "not authenticated" outcome.

```typescript
let verificationKey = JWK.importRemote(new URL(jwksUrl), { alg: JWK.Algorithm.ES256 });

export async function verify(raw: string) {
	try {
		return await IdToken.verify(raw, await verificationKey, {
			issuer: "https://auth.example.com",
			audience: clientId,
			clockTolerance: 60,
		});
	} catch {
		return null;
	}
}
```

The `try` has to wrap the accessor reads too if the caller reads claims the issuer does not guarantee — those throw from the getter, not from `verify`.

## Pattern: Keys In A Database Instead Of A Bucket

`signingKeys` is a convenience over one particular storage shape. When keys live in rows, skip it and drive `generateKeyPair`/`importKeyPair` directly — they are the whole contract.

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

- [`@pkg/crypto`](/packages/crypto) - WebCrypto primitives for the secrets that are not tokens: password hashing, HMAC, sealed storage
- [`@pkg/oidc-provider`](/packages/oidc-provider) - OIDC/OAuth2 provider engine, whose token value objects are built on `JWT`

## Tips

1. **Subclass per kind of token** - one class per token type, with an accessor for every claim it guarantees, is what keeps claim names out of handlers.
2. **Narrow the accessors you override** - a token that always carries `sub` should expose `string`, not `string | null`; that is the difference between one check and one at every call site.
3. **Resolve a remote JWKS once** - `importRemote` fetches. Hold the promise in a container singleton or at module scope, never per request.
4. **`decode` is not `verify`** - nothing it returns has been authenticated. Use it to route, never to decide.
5. **Always pass `issuer` and `audience` to `verify`** - a valid signature from the right issuer for the wrong audience is still someone else's token.
6. **Give `clockTolerance` a value** - a small window (60 seconds is typical) absorbs drift between the issuer and the verifier without meaningfully extending a token's life.
7. **Use `expired` for display, not for access control** - it reads `exp` in milliseconds; `verify` is what enforces expiry.
8. **Do not publish a second signing key** - see [the constraint above](#constraint-one-published-signing-key); resolution matches on algorithm alone and two keys resolve to none.
9. **Guard optional claims with `has`** - the typed reads throw, and `has` is the only cheap way to ask first.
10. **Never call `signingKeys` against an empty production bucket** - it will generate a key nobody's cached JWKS can verify.
