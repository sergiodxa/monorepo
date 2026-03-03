import type { Database } from "remix/data-table";

import { JWK } from "@edgefirst-dev/jwt";
import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";

// Cache TTL for signing keys (1 minute)
// Keys rarely change, but we keep TTL short for safety
const SIGNING_KEY_CACHE_TTL_MS = 60_000;

interface SigningKeyCache {
	keys: JWK.KeyPair[];
	expiresAt: number;
}

export default class SigningKey {
	// In-memory cache for imported key pairs
	// This avoids expensive key imports on every token operation
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

	static list(db: Database) {
		return db.findMany(SigningKey.table);
	}

	static show(db: Database, id: string) {
		return db.findOne(SigningKey.table, { where: { id } });
	}

	static async getCurrent(db: Database): Promise<JWK.KeyPair | null> {
		let record = await db.findOne(SigningKey.table, { where: { is_current: true } });
		if (!record) return null;

		// Keys are stored as PEM strings, which JWK.importKeyPair expects
		return await JWK.importKeyPair({
			id: record.id as `${string}-${string}-${string}-${string}-${string}`,
			alg: JWK.Algoritm.ES256,
			privateKey: record.private_key,
			publicKey: record.public_key,
			created: new Date(record.created_at).getTime(),
		});
	}

	static async getAll(db: Database): Promise<JWK.KeyPair[]> {
		// Return cached keys if still valid
		if (SigningKey.#cache && Date.now() < SigningKey.#cache.expiresAt) {
			return SigningKey.#cache.keys;
		}

		let records = await db.findMany(SigningKey.table);

		if (records.length === 0) {
			SigningKey.#cache = { keys: [], expiresAt: Date.now() + SIGNING_KEY_CACHE_TTL_MS };
			return [];
		}

		// Import all key pairs in parallel for better performance
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

		// Cache the imported keys
		SigningKey.#cache = { keys, expiresAt: Date.now() + SIGNING_KEY_CACHE_TTL_MS };

		return keys;
	}

	/**
	 * Invalidates the signing key cache.
	 * Call this after generating or rotating keys.
	 */
	static invalidateCache(): void {
		SigningKey.#cache = null;
	}

	static async generate(db: Database): Promise<JWK.KeyPair> {
		let rawKeyPair = await JWK.generateKeyPair(JWK.Algoritm.ES256);
		let keyPair = await JWK.importKeyPair(rawKeyPair);

		let existingCurrent = await db.findMany(SigningKey.table, {
			where: { is_current: true },
		});

		// Mark all existing current keys as not current in parallel
		if (existingCurrent.length > 0) {
			await Promise.all(
				existingCurrent.map((existing) =>
					db.update(SigningKey.table, { id: existing.id }, { is_current: false }),
				),
			);
		}

		let now = new Date().toISOString();

		// rawKeyPair.privateKey and publicKey are already PEM strings
		await db.create(SigningKey.table, {
			id: rawKeyPair.id,
			private_key: rawKeyPair.privateKey,
			public_key: rawKeyPair.publicKey,
			algorithm: "ES256",
			is_current: true,
			created_at: now,
			expires_at: null,
		});

		// Invalidate cache after generating new key
		SigningKey.invalidateCache();

		return keyPair;
	}

	static async rotate(db: Database): Promise<JWK.KeyPair> {
		let existingCurrent = await db.findMany(SigningKey.table, {
			where: { is_current: true },
		});

		// Mark all existing current keys as not current in parallel
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

		// rawKeyPair.privateKey and publicKey are already PEM strings
		await db.create(SigningKey.table, {
			id: rawKeyPair.id,
			private_key: rawKeyPair.privateKey,
			public_key: rawKeyPair.publicKey,
			algorithm: "ES256",
			is_current: true,
			created_at: now,
			expires_at: null,
		});

		// Invalidate cache after rotating keys
		SigningKey.invalidateCache();

		return keyPair;
	}

	static async destroy(db: Database, id: string) {
		let signingKey = await db.findOne(SigningKey.table, { where: { id } });
		if (!signingKey) throw new RecordNotFoundError(SigningKey.table, { id });

		// Don't allow deleting the current signing key
		if (signingKey.is_current) {
			throw new SigningKey.CannotDeleteCurrentKeyError();
		}

		let result = await db.delete(SigningKey.table, { id });

		// Invalidate cache after deleting key
		SigningKey.invalidateCache();

		return result;
	}

	static CannotDeleteCurrentKeyError = class extends Error {
		override name = "CannotDeleteCurrentKeyError";
		constructor() {
			super("Cannot delete the current signing key. Rotate first.");
		}
	};
}
