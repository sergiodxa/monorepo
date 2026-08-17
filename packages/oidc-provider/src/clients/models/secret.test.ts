/**
 * Tests for the client-secret model.
 *
 * Alongside the lifecycle cases these cover the stored-hash migration: a secret
 * written in the superseded bcrypt format must still authenticate its client, and
 * doing so must leave the row holding a hash in the current format.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Database as SqliteDatabase } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import bcrypt from "bcryptjs";
import { Database } from "remix/data-table";

import { RecordNotFoundError } from "../../shared/lib/db-errors";
import { createBunSqliteDatabaseAdapter } from "../../shared/test/db";
import { createClient } from "../../shared/test/fixtures";

import Secret from "./secret";

/** Cost factor every stored bcrypt hash was written with. */
const LEGACY_BCRYPT_COST = 10;

/** Prefix identifying the format written for new hashes. */
const CURRENT_PREFIX = "$pbkdf2-sha256$";

describe("Secret", () => {
	let sqliteDb: SqliteDatabase;
	let db: Database;

	beforeEach(async () => {
		sqliteDb = new SqliteDatabase(":memory:");
		let { default: migration } = await import("../../migrations/0001-init.sql?raw");
		sqliteDb.run(migration);
		let adapter = createBunSqliteDatabaseAdapter(sqliteDb);
		db = new Database(adapter);
	});

	afterEach(() => {
		sqliteDb.close();
	});

	/**
	 * Inserts a secret hashed the way every row written before the migration was,
	 * bypassing the model so the stored value is genuinely in the old format.
	 * @param clientId - Client the secret belongs to.
	 * @param plainSecret - Secret to hash with the superseded scheme.
	 */
	async function createLegacySecret(clientId: string, plainSecret: string) {
		await db.create(Secret.table, {
			id: crypto.randomUUID(),
			client_id: clientId,
			secret_hash: await bcrypt.hash(plainSecret, LEGACY_BCRYPT_COST),
			name: "Legacy Secret",
			last_used_at: null,
			expires_at: null,
			created_at: new Date().toISOString(),
		});
	}

	/**
	 * Reads the stored hash of a client's only secret.
	 * @param clientId - Client whose secret to read.
	 * @returns The stored hash, or null when the client has no secret.
	 */
	async function readStoredHash(clientId: string) {
		let stored = await db.findOne(Secret.table, { where: { client_id: clientId } });
		return stored?.secret_hash ?? null;
	}

	describe("generateSecretValue", () => {
		test("returns string starting with sdx_auth_", () => {
			let secret = Secret.generateSecretValue();
			expect(secret.startsWith("sdx_auth_")).toBe(true);
		});

		test("returns unique values each time", () => {
			let secret1 = Secret.generateSecretValue();
			let secret2 = Secret.generateSecretValue();
			let secret3 = Secret.generateSecretValue();

			expect(secret1).not.toBe(secret2);
			expect(secret2).not.toBe(secret3);
			expect(secret1).not.toBe(secret3);
		});
	});

	describe("list", () => {
		test("returns empty array when no secrets", async () => {
			let client = await createClient(db);
			let secrets = await Secret.list(db, client.id);
			expect(secrets).toEqual([]);
		});

		test("returns secrets for a client without secret_hash", async () => {
			let client = await createClient(db);
			await Secret.create(db, client.id, "Production Secret");
			await Secret.create(db, client.id, "Staging Secret");

			let secrets = await Secret.list(db, client.id);

			expect(secrets).toHaveLength(2);
			expect(secrets[0]).toHaveProperty("id");
			expect(secrets[0]).toHaveProperty("name");
			expect(secrets[0]).toHaveProperty("createdAt");
			expect(secrets[0]).toHaveProperty("lastUsedAt");
			expect(secrets[0]).toHaveProperty("expiresAt");
			expect(secrets[0]).not.toHaveProperty("secret_hash");

			let names = secrets.map((s) => s.name);
			expect(names).toContain("Production Secret");
			expect(names).toContain("Staging Secret");
		});
	});

	describe("create", () => {
		test("creates a secret and returns id and plainSecret", async () => {
			let client = await createClient(db);
			let result = await Secret.create(db, client.id, "My Secret");

			expect(result).toHaveProperty("id");
			expect(result).toHaveProperty("plainSecret");
			expect(typeof result.id).toBe("string");
			expect(result.plainSecret.startsWith("sdx_auth_")).toBe(true);
		});

		test("secret can be verified immediately after creation", async () => {
			let client = await createClient(db);
			let { plainSecret } = await Secret.create(db, client.id);

			let isValid = await Secret.verify(db, client.id, plainSecret);
			expect(isValid).toBe(true);
		});

		test("stores the hash in the current format", async () => {
			let client = await createClient(db);
			await Secret.create(db, client.id);

			expect(await readStoredHash(client.id)).toStartWith(CURRENT_PREFIX);
		});
	});

	describe("verify", () => {
		test("returns true for valid secret", async () => {
			let client = await createClient(db);
			let { plainSecret } = await Secret.create(db, client.id);

			let isValid = await Secret.verify(db, client.id, plainSecret);
			expect(isValid).toBe(true);
		});

		test("returns false for invalid secret", async () => {
			let client = await createClient(db);
			await Secret.create(db, client.id);

			let isValid = await Secret.verify(db, client.id, "sdx_auth_invalid_secret");
			expect(isValid).toBe(false);
		});

		test("returns false for expired secret", async () => {
			let client = await createClient(db);
			let pastDate = new Date(Date.now() - 1000).toISOString();
			let { plainSecret } = await Secret.create(db, client.id, "Expired Secret", pastDate);

			let isValid = await Secret.verify(db, client.id, plainSecret);
			expect(isValid).toBe(false);
		});

		test("updates last_used_at on successful verification", async () => {
			let client = await createClient(db);
			let { plainSecret } = await Secret.create(db, client.id);

			let secretsBefore = await Secret.list(db, client.id);
			expect(secretsBefore).toHaveLength(1);
			expect(secretsBefore[0]!.lastUsedAt).toBeNull();

			await Secret.verify(db, client.id, plainSecret);

			let secretsAfter = await Secret.list(db, client.id);
			expect(secretsAfter).toHaveLength(1);
			expect(secretsAfter[0]!.lastUsedAt).not.toBeNull();
		});

		test("returns false when no secrets exist (timing attack prevention)", async () => {
			let client = await createClient(db);

			let isValid = await Secret.verify(db, client.id, "sdx_auth_any_secret");
			expect(isValid).toBe(false);
		});

		test("returns true for a secret stored in the superseded hash format", async () => {
			let client = await createClient(db);
			let plainSecret = Secret.generateSecretValue();
			await createLegacySecret(client.id, plainSecret);

			let isValid = await Secret.verify(db, client.id, plainSecret);
			expect(isValid).toBe(true);
		});

		test("rewrites a superseded hash in the current format after a match", async () => {
			let client = await createClient(db);
			let plainSecret = Secret.generateSecretValue();
			await createLegacySecret(client.id, plainSecret);

			await Secret.verify(db, client.id, plainSecret);

			let upgraded = await readStoredHash(client.id);
			expect(upgraded).toStartWith(CURRENT_PREFIX);

			// The rewritten hash is the one the next request will be checked against.
			expect(await Secret.verify(db, client.id, plainSecret)).toBe(true);
			expect(await readStoredHash(client.id)).toBe(upgraded);
		});

		test("returns false for a wrong secret against a superseded hash, leaving it alone", async () => {
			let client = await createClient(db);
			await createLegacySecret(client.id, Secret.generateSecretValue());
			let before = await readStoredHash(client.id);

			let isValid = await Secret.verify(db, client.id, "sdx_auth_wrong_secret");

			expect(isValid).toBe(false);
			expect(await readStoredHash(client.id)).toBe(before);
		});
	});

	describe("destroy", () => {
		test("deletes the secret", async () => {
			let client = await createClient(db);
			let { id } = await Secret.create(db, client.id);

			let secretsBefore = await Secret.list(db, client.id);
			expect(secretsBefore).toHaveLength(1);

			await Secret.destroy(db, id);

			let secretsAfter = await Secret.list(db, client.id);
			expect(secretsAfter).toHaveLength(0);
		});

		test("throws RecordNotFoundError for non-existent secret", async () => {
			await expect(Secret.destroy(db, "non-existent-id")).rejects.toThrow(RecordNotFoundError);
		});
	});
});
