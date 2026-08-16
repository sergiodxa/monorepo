import { Database as SqliteDatabase } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { Database } from "remix/data-table";

import { createBunSqliteDatabaseAdapter } from "../../shared/test/db";

import Client from "./client";

describe("Client", () => {
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

	describe("create", () => {
		test("creates a public client", async () => {
			await Client.create(db, {
				name: "My App",
				type: "public",
			});

			let clients = await Client.list(db);
			expect(clients).toHaveLength(1);
			expect(clients[0]!.name).toBe("My App");
			expect(clients[0]!.type).toBe("public");
			expect(Boolean(clients[0]!.is_management_client)).toBe(false);
		});

		test("creates a confidential client", async () => {
			await Client.create(db, {
				name: "My Backend",
				type: "confidential",
				description: "Backend service",
			});

			let clients = await Client.list(db);
			expect(clients[0]!.type).toBe("confidential");
			expect(clients[0]!.description).toBe("Backend service");
		});

		test("creates a management client", async () => {
			await Client.create(db, {
				name: "Management",
				type: "m2m",
				isManagementClient: true,
			});

			let clients = await Client.list(db);
			expect(Boolean(clients[0]!.is_management_client)).toBe(true);
		});

		test("stores allowed scopes as JSON", async () => {
			await Client.create(db, {
				name: "My App",
				type: "public",
				allowedScopes: ["openid", "profile", "email"],
			});

			let clients = await Client.list(db);
			expect(clients[0]!.allowed_scopes).toBe('["openid","profile","email"]');
		});
	});

	describe("show", () => {
		test("returns client by id", async () => {
			await Client.create(db, {
				name: "My App",
				type: "public",
			});

			let clients = await Client.list(db);
			let client = await Client.show(db, clients[0]!.id);

			expect(client).not.toBeNull();
			expect(client?.name).toBe("My App");
		});

		test("returns null for non-existent id", async () => {
			let client = await Client.show(db, "non-existent-id");
			expect(client).toBeNull();
		});
	});

	describe("update", () => {
		test("updates client properties", async () => {
			await Client.create(db, {
				name: "My App",
				type: "public",
			});

			let clients = await Client.list(db);
			await Client.update(db, clients[0]!.id, {
				name: "Updated App",
				description: "New description",
			});

			let updated = await Client.show(db, clients[0]!.id);
			expect(updated?.name).toBe("Updated App");
			expect(updated?.description).toBe("New description");
		});
	});

	describe("destroy", () => {
		test("deletes client", async () => {
			await Client.create(db, {
				name: "My App",
				type: "public",
			});

			let clients = await Client.list(db);
			await Client.destroy(db, clients[0]!.id);

			let remaining = await Client.list(db);
			expect(remaining).toHaveLength(0);
		});
	});

	describe("validateLogoUrl", () => {
		test("returns null for null input", () => {
			expect(Client.validateLogoUrl(null)).toBeNull();
		});

		test("returns null for undefined input", () => {
			expect(Client.validateLogoUrl(undefined)).toBeNull();
		});

		test("accepts valid HTTPS URL", () => {
			let url = "https://example.com/logo.png";
			expect(Client.validateLogoUrl(url)).toBe(url);
		});

		test("accepts HTTP URL for localhost", () => {
			expect(Client.validateLogoUrl("http://localhost/logo.png")).toBe("http://localhost/logo.png");
			expect(Client.validateLogoUrl("http://localhost:3000/logo.png")).toBe(
				"http://localhost:3000/logo.png",
			);
			expect(Client.validateLogoUrl("http://127.0.0.1/logo.png")).toBe("http://127.0.0.1/logo.png");
		});

		test("accepts HTTPS URL for localhost", () => {
			expect(Client.validateLogoUrl("https://localhost/logo.png")).toBe(
				"https://localhost/logo.png",
			);
		});

		test("rejects HTTP URL for non-localhost", () => {
			expect(() => Client.validateLogoUrl("http://example.com/logo.png")).toThrow(
				Client.InvalidLogoUrlError,
			);
		});

		test("rejects javascript: scheme", () => {
			expect(() => Client.validateLogoUrl("javascript:alert(1)")).toThrow(
				Client.InvalidLogoUrlError,
			);
		});

		test("rejects data: scheme", () => {
			expect(() => Client.validateLogoUrl("data:image/png;base64,abc")).toThrow(
				Client.InvalidLogoUrlError,
			);
		});

		test("rejects vbscript: scheme", () => {
			expect(() => Client.validateLogoUrl("vbscript:msgbox(1)")).toThrow(
				Client.InvalidLogoUrlError,
			);
		});

		test("rejects file: scheme", () => {
			expect(() => Client.validateLogoUrl("file:///etc/passwd")).toThrow(
				Client.InvalidLogoUrlError,
			);
		});

		test("rejects invalid URL format", () => {
			expect(() => Client.validateLogoUrl("not-a-url")).toThrow(Client.InvalidLogoUrlError);
		});

		test("rejects FTP scheme", () => {
			expect(() => Client.validateLogoUrl("ftp://example.com/logo.png")).toThrow(
				Client.InvalidLogoUrlError,
			);
		});

		test("accepts localhost subdomains", () => {
			expect(Client.validateLogoUrl("http://app.localhost/logo.png")).toBe(
				"http://app.localhost/logo.png",
			);
		});
	});
});
