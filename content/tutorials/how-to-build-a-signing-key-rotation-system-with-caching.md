---
title: How to Build a Signing Key Rotation System with Caching
excerpt: Build a JWT signing key system that rotates keys, caches imports, and serves a JWKS endpoint.
tech: "@edgefirst-dev/jwt@1.0.0"
---

JWT issuers need more than a single signing key. You need one key for new tokens, old keys for verification, and a way to publish public keys to clients.

This tutorial builds that flow step by step. You will create a `SigningKey` model that stores keys, caches imported key pairs in memory, rotates the active key, and exposes a JWKS endpoint.

## Create the Signing Key Model

```ts {% path="app/models/signing-key.ts" %}
import type { Database } from "remix/data-table";

import { JWK } from "@edgefirst-dev/jwt";
import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";

const SIGNING_KEY_CACHE_TTL_MS = 60_000;

interface SigningKeyCache {
	keys: JWK.KeyPair[];
	expiresAt: number;
}

export default class SigningKey {
	static #cache: SigningKeyCache | null = null;

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

	static invalidateCache(): void {
		SigningKey.#cache = null;
	}

	static list(db: Database) {
		return db.findMany(SigningKey.table);
	}

	static show(db: Database, id: string) {
		return db.findOne(SigningKey.table, { where: { id } });
	}

	static CannotDeleteCurrentKeyError = class extends Error {
		override name = "CannotDeleteCurrentKeyError";

		constructor() {
			super("Cannot delete the current signing key. Rotate first.");
		}
	};
}
```

This table stores both the active key and rotated keys. The private cache gives you one place to reuse imported key pairs for a short time.

## Load All Keys Through the Cache

```ts {% path="app/models/signing-key.ts" %}
import type { Database } from "remix/data-table";

import { JWK } from "@edgefirst-dev/jwt";
import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";

const SIGNING_KEY_CACHE_TTL_MS = 60_000;

interface SigningKeyCache {
	keys: JWK.KeyPair[];
	expiresAt: number;
}

export default class SigningKey {
	static #cache: SigningKeyCache | null = null;

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

	static invalidateCache(): void {
		SigningKey.#cache = null;
	}

	static list(db: Database) {
		return db.findMany(SigningKey.table);
	}

	static show(db: Database, id: string) {
		return db.findOne(SigningKey.table, { where: { id } });
	}

	static CannotDeleteCurrentKeyError = class extends Error {
		override name = "CannotDeleteCurrentKeyError";

		constructor() {
			super("Cannot delete the current signing key. Rotate first.");
		}
	};
}
```

`getAll` uses a cache aside pattern. It avoids re-importing every key on every request, but the one minute TTL still keeps rotation changes moving quickly.

## Load the Current Key for Signing

```ts {% path="app/models/signing-key.ts" %}
export default class SigningKey {
	// ... previous code

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

Use `getCurrent` when you need the one key that signs new tokens. Rotated keys stay available through `getAll`, but they should not sign fresh tokens.

## Generate the First Key

```ts {% path="app/models/signing-key.ts" %}
export default class SigningKey {
	// ... previous code

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

This creates the first usable key pair and makes sure only one record is marked as current. Invalidating the cache matters because `getAll` may still be holding the old set.

## Rotate Keys Without Breaking Verification

```ts {% path="app/models/signing-key.ts" %}
export default class SigningKey {
	// ... previous code

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

Rotation keeps old keys in storage, so existing tokens still verify. New tokens switch to the new `kid` immediately because only one key stays current.

## Delete Rotated Keys Safely

```ts {% path="app/models/signing-key.ts" %}
export default class SigningKey {
	// ... previous code

	static async destroy(db: Database, id: string) {
		let signingKey = await db.findOne(SigningKey.table, { where: { id } });

		if (!signingKey) {
			throw new RecordNotFoundError(SigningKey.table, { id });
		}

		if (signingKey.is_current) {
			throw new SigningKey.CannotDeleteCurrentKeyError();
		}

		let result = await db.delete(SigningKey.table, { id });

		SigningKey.invalidateCache();

		return result;
	}
}
```

Delete only rotated keys, and only after your longest token lifetime has passed. That gives verifiers enough time to accept older tokens before you remove their public key.

## Expose the Public Keys as JWKS

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

Clients use this endpoint to fetch the public keys that verify your JWTs. Returning every active and rotated key is what makes rotation safe for tokens that are still valid.

## Sign and Verify Tokens

```ts {% path="app/services/token.ts" %}
import type { Database } from "remix/data-table";

import * as jose from "jose";

import SigningKey from "~/models/signing-key";

export async function issueAccessToken(db: Database, claims: jose.JWTPayload) {
	let keyPair = await SigningKey.getCurrent(db);

	if (!keyPair) {
		throw new Error("No signing key available");
	}

	return await new jose.SignJWT(claims)
		.setProtectedHeader({ alg: "ES256", kid: keyPair.id })
		.sign(keyPair.privateKey);
}

export async function verifyAccessToken(db: Database, token: string) {
	let keys = await SigningKey.getAll(db);

	if (keys.length === 0) {
		throw new Error("No signing keys available");
	}

	let { kid } = jose.decodeProtectedHeader(token);
	let keyPair = keys.find((key) => key.id === kid);

	if (!keyPair) {
		throw new Error("Unknown key ID");
	}

	return await jose.jwtVerify(token, keyPair.publicKey);
}
```

The `kid` header is the link between issued tokens and stored keys. Signing uses the current key, while verification can match any key that is still published.

## Final Thoughts

This setup gives you a practical rotation flow without making token verification slow. You can extend it with scheduled rotation, cleanup after token expiry, or monitoring around failed key generation.
