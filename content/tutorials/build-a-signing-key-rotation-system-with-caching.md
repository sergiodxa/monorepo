---
title: How to Build a Signing Key Rotation System with Caching
excerpt: Manage JWT signing keys with rotation, in-memory caching, and JWKS endpoint serving.
tech: "@edgefirst-dev/jwt@1.0.0"
---

When building an authentication system that issues JWTs, you need to manage cryptographic signing keys carefully. A single static key is a security risk: if it gets compromised, every token you have ever issued becomes vulnerable. Key rotation solves this by periodically generating new keys while keeping old ones around to verify existing tokens.

The challenge is doing this efficiently without importing keys from their stored format on every single token operation. This tutorial walks through building a signing key management system with three core capabilities: generating and storing key pairs, rotating keys while preserving old ones for verification, and caching imported keys in memory to avoid expensive cryptographic operations on every request.

## Define the Key Storage Schema

Start by defining how keys are stored in your database. Each key needs an identifier, the private and public key material, which algorithm it uses, whether it is the current signing key, and timestamps for lifecycle management.

```ts {% path="app/models/signing-key.ts" %}
import type { Database } from "remix/data-table";

import { JWK } from "@edgefirst-dev/jwt";
import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

export default class SigningKey {
	static table = createTable({
		name: "signing_keys",
		primaryKey: ["id"],
		columns: {
			id: s.string(),
			private_key: s.string(),
			public_key: s.string(),
			algorithm: s.defaulted(s.string(), "ES256"),
			is_current: s.defaulted(s.boolean(), true),
			created_at: s.string(),
			expires_at: s.nullable(s.string()),
		},
	});
}
```

The `is_current` flag distinguishes the active signing key from rotated keys. Only the current key signs new tokens, but all keys can verify existing tokens. The `expires_at` field allows you to mark keys for eventual deletion after a grace period.

## Set Up In-Memory Caching

Importing cryptographic keys from their stored PEM or JWK format is computationally expensive. Doing this on every token operation would hurt performance significantly. Instead, cache the imported key pairs in memory with a short TTL.

```ts {% path="app/models/signing-key.ts" %}
const SIGNING_KEY_CACHE_TTL_MS = 60_000;

interface SigningKeyCache {
	keys: JWK.KeyPair[];
	expiresAt: number;
}

export default class SigningKey {
	static #cache: SigningKeyCache | null = null;

	static invalidateCache(): void {
		SigningKey.#cache = null;
	}
}
```

The cache stores imported key pairs along with an expiration timestamp. A 60 second TTL balances performance with responsiveness to key changes. When you rotate keys, the cache refreshes within a minute without requiring manual cache busting across all workers.

The private static field `#cache` ensures the cache is encapsulated within the class. The `invalidateCache` method provides explicit control when you know keys have changed, such as immediately after rotation.

## Retrieve Keys with Cache-Aside Pattern

The core caching logic follows the cache-aside pattern: check the cache first, return if valid, otherwise fetch from the database and populate the cache.

```ts {% path="app/models/signing-key.ts" %}
export default class SigningKey {
	static async getAll(db: Database): Promise<JWK.KeyPair[]> {
		if (SigningKey.#cache && Date.now() < SigningKey.#cache.expiresAt) {
			return SigningKey.#cache.keys;
		}

		let records = await db.findMany(SigningKey.table);

		if (records.length === 0) {
			SigningKey.#cache = {
				keys: [],
				expiresAt: Date.now() + SIGNING_KEY_CACHE_TTL_MS,
			};
			return [];
		}

		let keys = await Promise.all(
			records.map((record) =>
				JWK.importKeyPair({
					id: record.id as `${string}-${string}-${string}-${string}-${string}`,
					alg: JWK.Algoritm.ES256,
					privateKey: record.private_key,
					publicKey: record.public_key,
					created: new Date(record.created_at).getTime(),
				}),
			),
		);

		SigningKey.#cache = {
			keys,
			expiresAt: Date.now() + SIGNING_KEY_CACHE_TTL_MS,
		};

		return keys;
	}
}
```

This method returns all signing keys as imported key pairs ready for cryptographic operations. The `Promise.all` imports all keys in parallel, minimizing the time spent when the cache is cold.

Note that we cache even empty results. This prevents repeated database queries when no keys exist yet, which is common during initial setup.

## Get the Current Signing Key

For signing new tokens, you only need the current active key. This method retrieves just the one marked as current.

```ts {% path="app/models/signing-key.ts" %}
export default class SigningKey {
	static async getCurrent(db: Database): Promise<JWK.KeyPair | null> {
		let record = await db.findOne(SigningKey.table, {
			where: { is_current: true },
		});
		if (!record) return null;

		return await JWK.importKeyPair({
			id: record.id as `${string}-${string}-${string}-${string}-${string}`,
			alg: JWK.Algoritm.ES256,
			privateKey: record.private_key,
			publicKey: record.public_key,
			created: new Date(record.created_at).getTime(),
		});
	}
}
```

This method does not use the cache because it needs to return the specific current key, not all keys. In practice, you might extend the caching strategy to track the current key separately, but the single-key import is fast enough for most use cases.

## Generate New Keys

When you first set up your auth system or need to create a key after deleting all existing ones, use the generate method.

```ts {% path="app/models/signing-key.ts" %}
export default class SigningKey {
	static async generate(db: Database): Promise<JWK.KeyPair> {
		let rawKeyPair = await JWK.generateKeyPair(JWK.Algoritm.ES256);
		let keyPair = await JWK.importKeyPair(rawKeyPair);

		let existingCurrent = await db.findMany(SigningKey.table, {
			where: { is_current: true },
		});

		if (existingCurrent.length > 0) {
			await Promise.all(
				existingCurrent.map((existing) =>
					db.update(SigningKey.table, { id: existing.id }, { is_current: false }),
				),
			);
		}

		let now = new Date().toISOString();

		await db.create(SigningKey.table, {
			id: rawKeyPair.id,
			private_key: rawKeyPair.privateKey,
			public_key: rawKeyPair.publicKey,
			algorithm: "ES256",
			is_current: true,
			created_at: now,
			expires_at: null,
		});

		SigningKey.invalidateCache();

		return keyPair;
	}
}
```

The method first generates a new ES256 key pair, then demotes any existing current keys before inserting the new one. This ensures there is always exactly one current key. Finally, it invalidates the cache so subsequent calls to `getAll` will fetch fresh data.

## Implement Key Rotation

Rotation is similar to generation but explicitly designed for the scenario where you are replacing an existing key. The old key remains in the database for token verification during the transition period.

```ts {% path="app/models/signing-key.ts" %}
export default class SigningKey {
	static async rotate(db: Database): Promise<JWK.KeyPair> {
		let existingCurrent = await db.findMany(SigningKey.table, {
			where: { is_current: true },
		});

		if (existingCurrent.length > 0) {
			await Promise.all(
				existingCurrent.map((existing) =>
					db.update(SigningKey.table, { id: existing.id }, { is_current: false }),
				),
			);
		}

		let rawKeyPair = await JWK.generateKeyPair(JWK.Algoritm.ES256);
		let keyPair = await JWK.importKeyPair(rawKeyPair);

		let now = new Date().toISOString();

		await db.create(SigningKey.table, {
			id: rawKeyPair.id,
			private_key: rawKeyPair.privateKey,
			public_key: rawKeyPair.publicKey,
			algorithm: "ES256",
			is_current: true,
			created_at: now,
			expires_at: null,
		});

		SigningKey.invalidateCache();

		return keyPair;
	}
}
```

After rotation, both the new key and old keys exist in the database. Tokens signed with the old key can still be verified because `getAll` returns all keys. Once enough time has passed (longer than your longest token lifetime), you can safely delete the old keys.

## Delete Old Keys Safely

When removing old keys, you need to prevent deleting the current signing key, as that would break token issuance.

```ts {% path="app/models/signing-key.ts" %}
export default class SigningKey {
	static CannotDeleteCurrentKeyError = class extends Error {
		override name = "CannotDeleteCurrentKeyError";
		constructor() {
			super("Cannot delete the current signing key. Rotate first.");
		}
	};

	static async destroy(db: Database, id: string) {
		let signingKey = await db.findOne(SigningKey.table, { where: { id } });
		if (!signingKey) throw new RecordNotFoundError(SigningKey.table, { id });

		if (signingKey.is_current) {
			throw new SigningKey.CannotDeleteCurrentKeyError();
		}

		let result = await db.delete(SigningKey.table, { id });

		SigningKey.invalidateCache();

		return result;
	}
}
```

The custom error class provides a clear message when someone attempts to delete the active key. The solution is simple: rotate first, then delete the old key.

## Serve Keys via JWKS Endpoint

OAuth2 and OIDC clients need to fetch your public keys to verify tokens. The standard way to expose them is through a JWKS (JSON Web Key Set) endpoint at `/.well-known/jwks.json`.

```ts {% path="app/controllers/discover/jwks.ts" %}
import { JWK } from "@edgefirst-dev/jwt";
import { ok } from "@pkg/http/response/json";

import SigningKey from "~/models/signing-key";

export default async function jwksHandler({ db, logger }) {
	let log = logger.loader("/.well-known/jwks.json");

	let signingKeys = await SigningKey.getAll(db);

	if (signingKeys.length === 0) {
		log.info("JWKS served", { keyCount: 0 });
		return ok(
			{ keys: [] },
			{
				headers: {
					"Content-Type": "application/json",
					"Cache-Control": "public, max-age=3600",
				},
			},
		);
	}

	let jwks = JWK.toJSON(signingKeys);

	log.info("JWKS served", { keyCount: signingKeys.length });

	return ok(jwks, {
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
```

The endpoint returns all public keys (the `JWK.toJSON` method strips private key material). The `Cache-Control` header tells clients they can cache the response for an hour, reducing load on your server. This cache duration should be shorter than your key rotation interval but long enough to be useful.

By serving all keys, not just the current one, clients can verify tokens signed by any active key. This is essential during rotation: tokens signed with the old key remain valid until they expire naturally.

## Use the Signing Keys

Here is how you would use this system when issuing tokens:

```ts {% path="app/services/token.ts" %}
import * as jose from "jose";

import SigningKey from "~/models/signing-key";

export async function issueAccessToken(db: Database, claims: object) {
	let keyPair = await SigningKey.getCurrent(db);
	if (!keyPair) throw new Error("No signing key available");

	return new jose.SignJWT(claims)
		.setProtectedHeader({ alg: "ES256", kid: keyPair.id })
		.sign(keyPair.privateKey);
}
```

And when verifying tokens, use all available keys:

```ts {% path="app/services/token.ts" %}
export async function verifyAccessToken(db: Database, token: string) {
	let keys = await SigningKey.getAll(db);
	if (keys.length === 0) throw new Error("No signing keys available");

	let { kid } = jose.decodeProtectedHeader(token);
	let keyPair = keys.find((k) => k.id === kid);
	if (!keyPair) throw new Error("Unknown key ID");

	return jose.jwtVerify(token, keyPair.publicKey);
}
```

The `kid` header in the JWT tells you which key signed it, allowing efficient lookup without trying every key.

## Understand Key Lifecycle

Keys move through three states in their lifecycle.

**Active** means the key has `is_current: true` and is used to sign new tokens. There should be exactly one active key at any time. All tokens issued use this key and include its `kid` (key ID) in the JWT header.

**Rotated** means the key has `is_current: false` and remains in the database. It no longer signs new tokens but is still returned by `getAll` and the JWKS endpoint. Existing tokens signed with this key can still be verified.

**Expired** means the key has been deleted from the database. Tokens signed with this key can no longer be verified. Only delete keys after waiting longer than your maximum token lifetime to ensure no valid tokens reference them.

## Final Thoughts

A proper key rotation system lets you maintain security hygiene without disrupting your users. The in-memory cache keeps token operations fast while the short TTL ensures changes propagate quickly. By preserving old keys during rotation, you avoid invalidating tokens that users are actively using.

Consider automating rotation on a schedule, perhaps monthly or quarterly, depending on your security requirements. You can use [Durable Object alarms](/tutorials/use-durable-object-alarms-for-background-cleanup) or a cron-triggered worker to call the rotate method periodically. Pair this with monitoring to alert when rotation fails or when you are running low on key capacity.
