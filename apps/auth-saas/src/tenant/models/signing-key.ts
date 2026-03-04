import type { Database } from "remix/data-table";

import { JWK } from "@edgefirst-dev/jwt";
import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";

/**
 * Cache TTL for signing keys (1 minute in milliseconds).
 * Keys rarely change, but we keep TTL short for safety during key rotation.
 */
const SIGNING_KEY_CACHE_TTL_MS = 60_000;

/** Cache structure for imported key pairs. */
interface SigningKeyCache {
	keys: JWK.KeyPair[];
	expiresAt: number;
}

/**
 * Model for JWT signing keys.
 * Manages cryptographic key pairs for signing and verifying tokens.
 * Keys are cached in-memory to avoid expensive imports on every token operation.
 */
export default class SigningKey {
	/** In-memory cache for imported key pairs. */
	static #cache: SigningKeyCache | null = null;

	/** Database table schema for signing keys. */
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

	/**
	 * Lists all signing keys.
	 * @param db - Database instance
	 * @returns Array of all signing key records
	 */
	static list(db: Database) {
		return db.findMany(SigningKey.table);
	}

	/**
	 * Retrieves a single signing key by ID.
	 * @param db - Database instance
	 * @param id - Signing key ID
	 * @returns Signing key record or null if not found
	 */
	static show(db: Database, id: string) {
		return db.findOne(SigningKey.table, { where: { id } });
	}

	/**
	 * Retrieves the current active signing key.
	 * @param db - Database instance
	 * @returns Imported key pair or null if no current key exists
	 */
	static async getCurrent(db: Database): Promise<JWK.KeyPair | null> {
		let record = await db.findOne(SigningKey.table, { where: { is_current: true } });
		if (!record) return null;

		return await JWK.importKeyPair({
			id: record.id as `${string}-${string}-${string}-${string}-${string}`,
			alg: JWK.Algoritm.ES256,
			privateKey: record.private_key,
			publicKey: record.public_key,
			created: new Date(record.created_at).getTime(),
		});
	}

	/**
	 * Retrieves all signing keys as imported key pairs.
	 * Results are cached for 1 minute to improve performance.
	 * @param db - Database instance
	 * @returns Array of imported key pairs
	 */
	static async getAll(db: Database): Promise<JWK.KeyPair[]> {
		if (SigningKey.#cache && Date.now() < SigningKey.#cache.expiresAt) {
			return SigningKey.#cache.keys;
		}

		let records = await db.findMany(SigningKey.table);

		if (records.length === 0) {
			SigningKey.#cache = { keys: [], expiresAt: Date.now() + SIGNING_KEY_CACHE_TTL_MS };
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

	/**
	 * Generates a new signing key and sets it as current.
	 * Any existing current keys are marked as not current.
	 * @param db - Database instance
	 * @returns The newly generated key pair
	 */
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

	/**
	 * Rotates the signing key by generating a new one and marking old keys as not current.
	 * Old keys are preserved for token verification during the transition period.
	 * @param db - Database instance
	 * @returns The newly generated key pair
	 */
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

	/**
	 * Deletes a signing key.
	 * The current signing key cannot be deleted; rotate first.
	 * @param db - Database instance
	 * @param id - Signing key ID
	 * @returns Deletion result
	 * @throws {RecordNotFoundError} If signing key does not exist
	 * @throws {CannotDeleteCurrentKeyError} If attempting to delete the current key
	 */
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

	/** Error thrown when attempting to delete the current signing key. */
	static CannotDeleteCurrentKeyError = class extends Error {
		override name = "CannotDeleteCurrentKeyError";
		constructor() {
			super("Cannot delete the current signing key. Rotate first.");
		}
	};
}
