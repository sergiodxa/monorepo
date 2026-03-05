import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { createDatabase } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";
import { createBunSqliteDatabaseAdapter } from "~/test/db";
import { createClient } from "~/test/fixtures";

import Secret from "./secret";

describe("Secret", () => {
	let sqliteDb: Database;
	let db: ReturnType<typeof createDatabase>;

	beforeEach(async () => {
		sqliteDb = new Database(":memory:");
		let { default: migration } = await import("../../migrations/0001-init.sql?raw");
		sqliteDb.run(migration);
		let adapter = createBunSqliteDatabaseAdapter(sqliteDb);
		db = createDatabase(adapter);
	});

	afterEach(() => {
		sqliteDb.close();
	});

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
