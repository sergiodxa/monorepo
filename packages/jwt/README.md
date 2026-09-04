# @sdxc/jwt

JWT payload classes and the ES256, RS256 and EdDSA keys that sign them.

## Installation

```bash
npm add @sdxc/jwt
```

Signing and verification run on [`jose`](https://www.npmjs.com/package/jose), and the duration strings the time claims accept come from [`@sdxc/duration`](https://www.npmjs.com/package/@sdxc/duration). Both install with the package.

## Usage

### Describing A Kind Of Token

Subclass `JWT` and give each claim the token guarantees a typed accessor.

```typescript
import { JWT } from "@sdxc/jwt";

export class IdToken extends JWT {
	// Narrowed: this token always carries `sub`, so the accessor is `string`.
	override get subject() {
		return this.parser.string("sub");
	}

	get email() {
		return this.parser.string("email");
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

// Hold this for the life of the process: it caches the fetched key set.
let keys = await JWK.importRemote(new URL("https://auth.example.com/.well-known/jwks.json"));

let idToken = await IdToken.verify(rawToken, keys, {
	issuer: "https://auth.example.com",
	audience: clientId,
	algorithms: [JWK.Algorithm.ES256],
	clockTolerance: 60,
});

idToken.subject; // "user-123"
idToken.email; // "ada@example.com"
```

## API

### `JWT`

A JWT claim set with the registered claims exposed as accessors. Subclass it to add accessors for the claims a kind of token carries, or use it directly when a token needs none of its own.

#### `new JWT(payload?: JWT.PayloadInput)`

Wraps a claim set, defaulting to `{}` so a token can be built up through the setters.

`exp`, `iat`, and `nbf` accept a duration string as well as a number. Written as text, the claim is that long from the moment the token is built; written as a number, it is used as the seconds since the epoch. Either way `payload` holds the resolved seconds.

Instances are proxied: a claim with no accessor still reads by name and answers `null` when absent, and assigning an unknown property writes it into the payload, so it is carried into the signature.

```typescript
let jwt = new JWT({ sub: "user-123", scope: "read", exp: "1h" });
jwt.scope; // "read" — no accessor declared, read through the payload
jwt.missing; // null
```

#### `jwt.payload`

The raw claim set, readable whole, and the same object the accessors read through.

#### `jwt.parser`

Protected. Type-checked reads over `payload` for the accessors a subclass defines: `has`, `get`, `string`, `number`, `boolean`, and `object`. Every read but `has` throws on a malformed payload — a claim that is absent, or one holding another JSON type — rather than coercing, so `"true"` read as a `boolean` is an error. Ask with `has` first for an optional claim.

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

Each accessor answers `null` for an absent claim. The setters take `null` to drop the claim, and convert `Date` values to epoch seconds. `expiresIn` counts the seconds left before `exp` and goes negative once it has passed, and `expired` follows from it; both report what the claim says, which suits display and cache decisions, while `JWT.verify` is what enforces expiry.

#### `jwt.sign(algorithm: JWK.Algorithm, jwks: JWK.SigningKey[]): Promise<string>`

Signs this token with the first key in the set generated for that algorithm, writing that key's `kid` into the header, and returns the compact-serialized token. Throws when the set holds no key for the algorithm. `JWT.sign(jwt, algorithm, jwks)` is the static form, for signing a token you were handed.

#### `jwt.toJSON(): Record<string, unknown>`

The claims a subclass exposes, as a plain object, read from the getters declared on the instance's own prototype.

#### `JWT.verify(token: string, jwks: JWK.VerificationKeys, options?: JWT.VerifyOptions): Promise<JWT>`

Verifies a token and returns it as an instance of the class the method was called on. `jwks` is either the keys themselves as `VerificationKey[]` or a resolver from `JWK.importLocal` / `JWK.importRemote`; `options` carries `issuer`, `audience`, `algorithms`, `clockTolerance`, and the rest of `jose`'s verify options. Signature, `exp`, `nbf`, and whichever of `issuer` and `audience` are given are all checked, and the first failure throws.

The key is chosen per token from the header it carries: the key its `kid` names, narrowed by key type, curve, algorithm, and intended use. Exactly one match verifies the token; none, or several the token gives no way to choose between, is an error. Choosing per token is what lets an issuer publish several keys at once. Pass `algorithms` with the ones you expect, so a token naming one algorithm is answered only with a key published for it.

#### `JWT.decode(token: string): JWT`

Reads a token's claims as the token presents them, as an instance of the class this was called on. Use it to decide how to verify a token — reading `iss` to pick a key set, for instance — and let `verify` be what every decision about the request rests on.

#### Types

`JWT.Payload` is `jose.JWTPayload`, with every time claim as epoch seconds. `JWT.PayloadInput` is the same claim set with `exp`, `iat`, and `nbf` also accepting a duration string. `JWT.VerifyOptions` is `jose.JWTVerifyOptions`.

### `JWK`

#### `JWK.Algorithm`

The supported signature algorithms, as `JWK.Algorithm.ES256`, `.RS256`, and `.EdDSA`.

| Algorithm | `kty` | Reach for it when                                    |
| --------- | ----- | ---------------------------------------------------- |
| `ES256`   | `EC`  | Signing; it is what a bootstrapped key is minted for |
| `RS256`   | `RSA` | Verifying an upstream identity provider's tokens     |
| `EdDSA`   | `OKP` | Signing, where a deterministic nonce is wanted       |

All three coexist in one key set, since verification picks a key by the `kid` and algorithm a token names. The names are also importable on their own, for a caller that reads or lists them without the key machinery behind them:

```typescript
import * as Algorithm from "@sdxc/jwt/algorithm";

Object.values(Algorithm); // ["ES256", "RS256", "EdDSA"]
```

#### `JWK.generateKeyPair(alg: JWK.Algorithm): Promise<JWK.SerializedKeyPair>`

Generates a key pair in serialized form: PEM strings and a millisecond timestamp, so the pair survives `JSON.stringify` into a bucket or a text column. Keys are extractable, so a pair written by one process imports in every other one.

#### `JWK.importKeyPair(value: JWK.SerializedKeyPair): Promise<JWK.KeyPair>`

Imports a stored pair back into usable `CryptoKey` objects and attaches the public half as a JWK stamped with `kid` and `use: "sig"`, so the identifier a token header carries and the one the JWKS advertises stay the same. The public half imports extractable; the private half stays confined to the runtime. Keys held in database rows need nothing beyond this and `generateKeyPair`; cache the result, since each call imports two keys.

#### `JWK.signingKeys(storage: KeyStorage): Promise<JWK.KeyPair[]>`

Loads every signing key out of storage, newest first, which is the order `sign` picks from and `toJSON` publishes in. A set holding several is the normal state during a rotation: the newest signs, and the older ones stay published so the tokens they signed keep verifying. When nothing usable is stored, an ES256 key is generated, written back, and returned.

#### `JWK.importLocal(jwks: jose.JSONWebKeySet): Promise<JWK.KeyResolver>`

Turns a key set that is already in hand into a resolver `JWT.verify` accepts.

#### `JWK.importRemote(url: URL, options?: JWK.RemoteOptions): Promise<JWK.KeyResolver>`

Points a resolver at a JWKS endpoint. The document is fetched when a token first needs it and then held, so hold the resolver for the life of the process and every verification shares one fetched set. It is fetched again, at most once per cooldown window, when a token names a `kid` the held copy lacks — which is what carries a verifier across a rotation between deploys.

#### `JWK.toJSON(keys: JWK.KeyPair[]): jose.JSONWebKeySet`

Renders key pairs as the JSON a `/.well-known/jwks.json` endpoint serves. Each entry carries `kty`, `kid`, `alg`, and the public parameters its key type publishes — `crv`, `x`, `y` for `EC`, `crv`, `x` for `OKP`, `e`, `n` for `RSA` — which is what keeps private components out of the document. A key type outside that list throws, for the document as a whole.

#### Types

```typescript
interface KeyPair {
	id: string; // published as the `kid`
	alg: Algorithm;
	public: jose.CryptoKey;
	private: jose.CryptoKey;
	created: Date;
	expired?: Date; // set once the pair is retired from signing
	jwk: jose.JWK; // public half, ready to publish
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
	jwk: jose.JWK;
} // carries the `kid` a token names
```

`JWK.KeyResolver` is `jose.JWTVerifyGetKey`, which answers with the key a given token calls for; `JWK.VerificationKeys` is `KeyResolver | VerificationKey[]`, what `JWT.verify` takes; `JWK.RemoteOptions` is `jose.RemoteJWKSetOptions`. `KeyPair` satisfies both `SigningKey` and `VerificationKey`, so a full pair is accepted anywhere either is.

### `KeyStorage`

The storage contract `JWK.signingKeys` is written against: a key/value store of `File` objects that pages by prefix.

```typescript
interface KeyStorage {
	get(key: string): File | null | Promise<File | null>;
	list(options?: KeyStorageListOptions): KeyStorageListResult | Promise<KeyStorageListResult>;
	set(key: string, file: File): void | Promise<void>;
}

interface KeyStorageListOptions {
	cursor?: string;
	limit?: number;
	prefix?: string;
}
interface KeyStorageListResult {
	cursor?: string;
	files: { key: string }[];
}
```

To implement it: `get` answers `null` for a key nothing is stored under; `list` returns the entries whose key starts with `prefix`, at most `limit` of them, resuming from `cursor`, and carries a `cursor` of its own only while further pages remain; `set` replaces whatever is stored under the key. Each method may be synchronous or return a promise, so a plain object satisfies the contract in a test while an object store satisfies it in production. `signingKeys` writes each pair as a JSON `SerializedKeyPair` under the key `signing:key:<id>` and lists with the prefix `signing:key` to find them again, so keep every key ever written and every token it signed stays verifiable.

## Rotation, And The Order To Roll It Out In

A rotation adds a key: the issuer writes a new pair into storage, `signingKeys` returns it first, `sign` picks it as the newest, and the retired key stays in the published JWKS so the tokens it signed keep verifying until they expire. That rests on every verifier resolving a key per token by `kid`, which makes the rollout order a deployment constraint:

1. Deploy the verifiers first, and confirm they are live on a version that resolves a key per token.
2. Then let the issuer publish more than one key.

A verifier picks a newly published key up when a token first names it, so keep a retired key published for at least as long as the tokens it signed can live.

## Pattern: Verifying An Upstream ID Token

Resolve the key set once and hold it, so every verification shares one fetched document. Pin `algorithms` to what the provider signs with — that is its choice, so read its discovery document rather than assuming — and treat every failure, from an unreachable JWKS to a wrong issuer, as the same "not authenticated" outcome.

```typescript
import { JWK, JWT } from "@sdxc/jwt";

let keys = JWK.importRemote(new URL("https://accounts.example.com/.well-known/jwks.json"));

export async function verifyIdToken(raw: string, clientId: string) {
	try {
		return await JWT.verify(raw, await keys, {
			issuer: "https://accounts.example.com",
			audience: clientId,
			algorithms: [JWK.Algorithm.RS256],
			clockTolerance: 60,
		});
	} catch {
		return null;
	}
}
```

A subclass accessor for a claim the provider treats as optional throws from the getter, so keep those reads inside the same `try`.

## Pattern: Keys In A Database Instead Of A Bucket

`JWK.signingKeys` is a convenience over one storage shape, the `KeyStorage` one. When keys live in rows instead, drive `generateKeyPair` and `importKeyPair` directly against the database client — those two are the whole contract, and what they hand back is the same `JWK.KeyPair[]` that `sign` and `JWK.toJSON` take.

```typescript
import { JWK } from "@sdxc/jwt";

// Minting: a serialized pair is PEM strings and a timestamp, so it stores as plain columns.
let serialized = await JWK.generateKeyPair(JWK.Algorithm.ES256);

await db.insert("signing_keys", {
	id: serialized.id,
	alg: serialized.alg,
	public_key: serialized.publicKey,
	private_key: serialized.privateKey,
	created_at: new Date(serialized.created).toISOString(),
});

// Signing and publishing: import every stored row back, newest first.
let rows = await db.select("signing_keys", { orderBy: "created_at desc" });

let keys = await Promise.all(
	rows.map((row) =>
		JWK.importKeyPair({
			id: row.id as JWK.SerializedKeyPair["id"], // a UUID, as `generateKeyPair` wrote it
			alg: row.alg,
			publicKey: row.public_key,
			privateKey: row.private_key,
			created: new Date(row.created_at).getTime(),
		}),
	),
);
```

Each import loads two keys, so cache the resulting pairs for the life of a request at minimum.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/jwt": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
