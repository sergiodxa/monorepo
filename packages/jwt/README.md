# @sdxc/jwt

JWT payload classes and the ES256, RS256 and Ed25519 keys that sign them.

Each kind of token is a class: the registered claims arrive as typed accessors, a subclass adds
its own, and signing, verifying and decoding all hand back an instance of that class. The `JWK`
namespace covers a key's whole life: generating, storing, importing, publishing as a JWKS and
resolving someone else's JWKS for verification.

## Installation

```sh
npm add @sdxc/jwt
```

Signing and verification run on [`jose`](https://www.npmjs.com/package/jose), and duration strings
for the time claims come from [`@sdxc/duration`](https://www.npmjs.com/package/@sdxc/duration);
both install with the package. Three entry points: `@sdxc/jwt` (`JWT`, `SecurityEventToken`, `JWK`, `KeyStorage`),
`@sdxc/jwt/algorithm` (the algorithm names alone) and `@sdxc/jwt/r2` (key storage over a
Cloudflare R2 bucket).

## Usage

### Describe a kind of token

Subclass `JWT` and read each claim the token carries through `this.parser`, which type-checks it.

```typescript
import { JWT } from "@sdxc/jwt";

export class IdToken extends JWT {
	override get subject() {
		return this.parser.string("sub");
	}

	get email() {
		return this.parser.string("email");
	}
}
```

### Issue a token

`JWK.signingKeys` loads the keys from storage, minting an ES256 key the first time. Time claims
accept a duration measured from now.

```typescript
import { JWK } from "@sdxc/jwt";
import { createR2KeyStorage } from "@sdxc/jwt/r2";
import { env } from "cloudflare:workers";

import { IdToken } from "./id-token.js";

let keys = await JWK.signingKeys(createR2KeyStorage(env.KEYS));

let token = new IdToken({
	iss: "https://auth.example.com",
	sub: "user-123",
	aud: "client-abc",
	email: "ada@example.com",
	iat: "0s",
	exp: "1h",
});

let signed = await token.sign(JWK.Algorithm.ES256, keys);
```

### Publish the key set

```typescript
let jwks = JWK.toJSON(keys);

return Response.json(jwks); // served at /.well-known/jwks.json
```

### Verify a token

Point a resolver at the issuer's JWKS once and keep it; `verify` answers an instance of the class
it is called on.

```typescript
import { JWK } from "@sdxc/jwt";

import { IdToken } from "./id-token.js";

let keys = await JWK.importRemote(new URL("https://auth.example.com/.well-known/jwks.json"));

let idToken = await IdToken.verify(rawToken, keys, {
	issuer: "https://auth.example.com",
	audience: "client-abc",
	algorithms: [JWK.Algorithm.ES256],
});

idToken.subject; // "user-123"
idToken.email; // "ada@example.com"
```

### Issue a Security Event Token

`SecurityEventToken` is an RFC 8417 SET: typed `secevent+jwt`, with `iss`, `iat`, `jti`, `aud`
and a map of event URI to payload. `create` fills `jti` and `iat`; `verify` refuses a SET with no
events or with an `exp`.

```typescript
import { JWK, SecurityEventToken } from "@sdxc/jwt";

let set = await SecurityEventToken.create({
	issuer: "https://idp.example.com/",
	audience: "https://rp.example.com/",
	subjectId: { format: "email", email: "user@example.com" },
	events: {
		"https://schemas.openid.net/secevent/risc/event-type/account-disabled": { reason: "hijacking" },
	},
}).sign(JWK.Algorithm.ES256, keys);

let event = await SecurityEventToken.verify(set, issuerKeys, { issuer, audience });
event.events; // { "https://schemas.openid.net/…/account-disabled": { reason: "hijacking" } }
event.subjectId; // { format: "email", email: "user@example.com" }
```

## API

### `JWT`

A claim set with the registered claims as accessors. Use it directly, or subclass it per kind of
token.

#### `new JWT(payload?: JWT.PayloadInput)`

Wraps a claim set, `{}` by default. `exp`, `iat` and `nbf` take seconds since the epoch or a
duration string (`"1h"`) measured from construction; `payload` holds the resolved seconds. A
claim with no accessor still reads by name (`null` when absent), and assigning an unknown property
writes it into the payload.

#### `jwt.payload`

The resolved claim set the accessors read and `sign` signs.

#### `jwt.parser`

Protected, for subclass accessors: `has(key)`, `get(key)`, `string(key)`, `number(key)`,
`boolean(key)` and `object(key)` (a parser over a nested object). Every read but `has` throws when
the claim is absent or holds another JSON type, so guard an optional claim with `has`.

#### Registered claim accessors

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

Absent claims read `null`, and setting `null` drops the claim. `expiresIn` is the seconds left
(negative once past), and `expired` is `true` once it reaches zero; `verify` is what enforces
expiry.

#### `jwt.sign(algorithm: JWK.Algorithm, jwks: JWK.SigningKey[]): Promise<string>`

Signs with the first key generated for `algorithm`, writes its id as the header `kid`, and answers
the compact token. Throws when no key matches. `JWT.sign(jwt, algorithm, jwks)` is the static form.

#### `jwt.toJSON(): Record<string, unknown>`

The getters declared on the instance's own class, as a plain object.

#### `JWT.verify(token: string, jwks: JWK.VerificationKeys, options?: JWT.VerifyOptions): Promise<JWT>`

Checks the signature, `exp`, `nbf` and any `issuer`/`audience` given, and answers an instance of
the calling class; any failure throws. The key is picked per token by its `kid`, key type and
algorithm, so a set can hold several keys. Pass `algorithms` to accept only the ones you expect;
left out, it is every `JWK.Algorithm`, so `none`, HMAC and anything else is refused. `Ed25519`
also accepts tokens and key sets that use the deprecated `EdDSA` name (RFC 9864).

A subclass that sets `static override type = "at+jwt"` signs with that `typ` header, and its
`verify` refuses a token of any other type (explicit typing, RFC 8725).

#### `JWT.decode(token: string): JWT`

Reads the claims without verifying them, as an instance of the calling class. Use it to decide how
to verify (reading `iss` to pick a key set), then `verify`.

### `SecurityEventToken`

A `JWT` subclass for RFC 8417 Security Event Tokens; subclass it for a SET profile.

- `SecurityEventToken.create(input)`: `issuer`, `audience` and `events`, plus optional `id`
  (`jti`), `issuedAt`, `subject`, `subjectId`, `transaction` (`txn`) and `timeOfEvent` (`toe`)
- `SecurityEventToken.verify(...)`: `JWT.verify` plus RFC 8417's claim rules; a failure throws
  jose's `JWTClaimValidationFailed` naming the claim
- `events`, `transaction`, `timeOfEvent` and `subjectId` accessors; `subjectId` types RFC 9493's
  `email`, `iss_sub` and `opaque` formats and reads any other format as given

### `JWK`

#### `JWK.Algorithm`

The supported algorithms: `JWK.Algorithm.ES256` (`EC`, what `signingKeys` mints), `.RS256`
(`RSA`, common among upstream identity providers) and `.Ed25519` (`OKP`, deterministic nonces). The
names also ship alone from `@sdxc/jwt/algorithm`:

```typescript
import * as Algorithm from "@sdxc/jwt/algorithm";

Object.values(Algorithm); // ["ES256", "RS256", "Ed25519"]
```

#### `JWK.generateKeyPair(alg: JWK.Algorithm): Promise<JWK.SerializedKeyPair>`

Generates an extractable key pair as PEM strings, a UUID `id` and a millisecond timestamp, ready
for `JSON.stringify` into a bucket or columns.

#### `JWK.importKeyPair(value: JWK.SerializedKeyPair): Promise<JWK.KeyPair>`

Imports a stored pair into `CryptoKey` objects, attaching the public half as a JWK with `kid` and
`use: "sig"`. The private key stays non-extractable. Each call imports two keys, so cache the
result.

#### `JWK.signingKeys(storage: KeyStorage): Promise<JWK.KeyPair[]>`

Loads every key stored under `signing:key:<id>`, newest first, which is the order `sign` picks
from. When none is unexpired, it mints and stores an ES256 key first.

#### `JWK.importLocal(jwks: jose.JSONWebKeySet): Promise<JWK.KeyResolver>`

A resolver over a key set already in hand.

#### `JWK.importRemote(url: URL, options?: JWK.RemoteOptions): Promise<JWK.KeyResolver>`

A resolver over a JWKS endpoint. It fetches on first use, holds the result, and refetches (at most
once per cooldown) when a token names an unknown `kid`, which carries verifiers through a key
rotation. Create it once per process.

#### `JWK.toJSON(keys: JWK.KeyPair[]): JWK.PublishedKeySet`

The JWKS document for `/.well-known/jwks.json`: each entry carries `kty`, `kid`, `alg` and only the
public parameters (`crv`/`x`/`y` for `EC`, `crv`/`x` for `OKP`, `e`/`n` for `RSA`). Throws on any
other key type.

#### `JWK.thumbprint(jwk: jose.JWK): Promise<Result<string, Error>>`

The key's RFC 7638 SHA-256 thumbprint, base64url, which Web Bot Auth uses as `keyid`. A private
JWK and its public half share one thumbprint; a key missing a required member is a failure.

#### Types

```typescript
interface KeyPair {
	id: string; // the `kid`
	alg: Algorithm;
	public: jose.CryptoKey;
	private: jose.CryptoKey;
	created: Date;
	expired?: Date; // set once retired from signing
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
}
```

A `KeyPair` satisfies both `SigningKey` and `VerificationKey`. `JWK.KeyResolver` is
`jose.JWTVerifyGetKey`; `JWK.VerificationKeys` is `KeyResolver | VerificationKey[]`;
`JWK.RemoteOptions` is `jose.RemoteJWKSetOptions`. `JWK.PublishedKeySet` is `{ keys:
PublishedKey[] }`, where `JWK.PublishedKey` is a JWKS entry with a required `kty`.

### `KeyStorage`

The store `JWK.signingKeys` reads and writes: `File` values under string keys, listed by prefix.
Each method may be synchronous or return a promise.

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
	cursor?: string; // present only while more pages remain
	files: { key: string }[];
}
```

`get` answers `null` for an unknown key, `list` pages entries whose key starts with `prefix`, and
`set` replaces what is stored. Keep every key ever written so every token it signed stays
verifiable.

### `createR2KeyStorage(bucket: R2KeyBucket): KeyStorage`

From `@sdxc/jwt/r2`. A `KeyStorage` over a Cloudflare R2 bucket, so every Worker issuing for one
issuer shares the same keys. Files read back with the name, type and upload time they were stored
with. `R2KeyBucket` is the `get`/`list`/`put` part of a bucket binding, which an `R2Bucket`
satisfies; `R2KeyObject` is what its `get` answers.

## Pattern: An Issuer In A Worker

Sign tokens and serve the matching JWKS from the same R2-backed key set.

```typescript
import { JWK, JWT } from "@sdxc/jwt";
import { createR2KeyStorage } from "@sdxc/jwt/r2";
import { generateUUID } from "@sdxc/uuid/v4";
import { env } from "cloudflare:workers";

let ISSUER = "https://auth.example.com";

export default {
	async fetch(request: Request) {
		let url = new URL(request.url);
		let keys = await JWK.signingKeys(createR2KeyStorage(env.KEYS));

		if (url.pathname === "/.well-known/jwks.json") {
			return Response.json(JWK.toJSON(keys));
		}

		let token = new JWT({ iss: ISSUER, sub: "user-123", aud: "api", iat: "0s", exp: "15m" });
		token.id = generateUUID();

		return Response.json({ access_token: await token.sign(JWK.Algorithm.ES256, keys) });
	},
};
```

## Pattern: Verifying An Upstream ID Token

Hold one resolver per provider, pin `algorithms` to what the provider's discovery document lists,
and treat every failure as "not authenticated". Subclass getters throw on a missing or mistyped
claim, so read them inside the same `try`.

```typescript
import { JWK, JWT } from "@sdxc/jwt";

class ProviderIdToken extends JWT {
	get email() {
		return this.parser.string("email");
	}

	get emailVerified() {
		return this.parser.has("email_verified") && this.parser.boolean("email_verified");
	}
}

let KEYS = JWK.importRemote(new URL("https://accounts.example.com/.well-known/jwks.json"));

export async function verifyIdToken(raw: string, clientId: string) {
	try {
		let token = await ProviderIdToken.verify(raw, await KEYS, {
			issuer: "https://accounts.example.com",
			audience: clientId,
			algorithms: [JWK.Algorithm.RS256],
			clockTolerance: 60,
		});
		if (!token.emailVerified) return null;
		return { subject: token.subject, email: token.email };
	} catch {
		return null;
	}
}
```

## Pattern: Several Issuers, One Verifier

`decode` reads `iss` before anything is trusted, to pick which key set verifies the token.

```typescript
import { JWK, JWT } from "@sdxc/jwt";

let ISSUERS = new Map([
	[
		"https://auth.example.com",
		JWK.importRemote(new URL("https://auth.example.com/.well-known/jwks.json")),
	],
	["https://login.example.org", JWK.importRemote(new URL("https://login.example.org/keys"))],
]);

export async function verify(raw: string) {
	let issuer = JWT.decode(raw).issuer;
	let keys = issuer ? ISSUERS.get(issuer) : undefined;
	if (!issuer || !keys) return null;

	return JWT.verify(raw, await keys, { issuer, audience: "api" });
}
```

## Pattern: Rotating Signing Keys

A rotation adds a key. Store a new pair under `signing:key:<id>`; `signingKeys` returns it first,
so it signs from then on, while the older keys stay in the JWKS and keep verifying what they signed.
Keep a retired key stored for at least as long as its tokens live.

```typescript
import { JWK } from "@sdxc/jwt";
import { createR2KeyStorage } from "@sdxc/jwt/r2";
import { env } from "cloudflare:workers";

let storage = createR2KeyStorage(env.KEYS);
let pair = await JWK.generateKeyPair(JWK.Algorithm.ES256);

await storage.set(
	`signing:key:${pair.id}`,
	new File([JSON.stringify(pair)], "jwks.json", { type: "application/json" }),
);

let keys = await JWK.signingKeys(storage); // keys[0].id === pair.id
```

Deploy verifiers that resolve keys by `kid` before the issuer publishes a second key; a verifier
built on `JWK.importRemote` picks the new key up the first time a token names it.

## Pattern: Keys In A Database

When keys live in rows, `generateKeyPair` and `importKeyPair` are all you need; the imported
pairs work with `sign` and `JWK.toJSON` exactly like `signingKeys` output.

```typescript
import { JWK } from "@sdxc/jwt";

let serialized = await JWK.generateKeyPair(JWK.Algorithm.ES256);

await db.insert("signing_keys", {
	id: serialized.id,
	alg: serialized.alg,
	public_key: serialized.publicKey,
	private_key: serialized.privateKey,
	created_at: serialized.created,
});

let rows = await db.select("signing_keys", { orderBy: "created_at desc" });

let keys = await Promise.all(
	rows.map((row) =>
		JWK.importKeyPair({
			id: row.id as JWK.SerializedKeyPair["id"],
			alg: row.alg as JWK.Algorithm,
			publicKey: row.public_key,
			privateKey: row.private_key,
			created: row.created_at,
		}),
	),
);
```

## Pattern: In-Memory Key Storage For Tests

A `Map` satisfies `KeyStorage` synchronously, so a test signs and verifies with no bucket.

```typescript
import type { KeyStorage } from "@sdxc/jwt";

import { JWK, JWT } from "@sdxc/jwt";
import { expect, test } from "vitest";

function memoryStorage(): KeyStorage {
	let files = new Map<string, File>();
	return {
		get: (key) => files.get(key) ?? null,
		list: ({ prefix = "" } = {}) => ({
			files: [...files.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })),
		}),
		set: (key, file) => void files.set(key, file),
	};
}

test("a signed token verifies against the published set", async () => {
	let keys = await JWK.signingKeys(memoryStorage());
	let signed = await new JWT({ sub: "user-123", exp: "5m" }).sign(JWK.Algorithm.ES256, keys);

	let verified = await JWT.verify(signed, await JWK.importLocal(JWK.toJSON(keys)));

	expect(verified.subject).toBe("user-123");
});
```

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
