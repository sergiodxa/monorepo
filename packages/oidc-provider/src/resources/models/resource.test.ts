import { Database as SqliteDatabase } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { Database } from "remix/data-table";

import { createBunSqliteDatabaseAdapter } from "../../shared/test/db";

import Resource from "./resource";

describe("Resource", () => {
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
		test("creates a resource with scopes", async () => {
			await Resource.create(db, {
				identifier: "https://api.example.com",
				name: "Example API",
				description: "An example API resource",
				scopes: [
					{ name: "read", description: "Read access" },
					{ name: "write", description: "Write access" },
				],
			});

			let resources = await Resource.list(db);
			expect(resources).toHaveLength(1);
			expect(resources[0]!.identifier).toBe("https://api.example.com");
			expect(resources[0]!.name).toBe("Example API");
			expect(resources[0]!.description).toBe("An example API resource");

			let scopes = Resource.parseScopes(resources[0]!);
			expect(scopes).toHaveLength(2);
			expect(scopes[0]!.name).toBe("read");
			expect(scopes[1]!.name).toBe("write");
		});

		test("creates a resource without description", async () => {
			await Resource.create(db, {
				identifier: "https://api.test.com",
				name: "Test API",
				scopes: [{ name: "admin" }],
			});

			let resources = await Resource.list(db);
			expect(resources[0]!.description).toBeNull();
		});
	});

	describe("show", () => {
		test("returns resource by id", async () => {
			await Resource.create(db, {
				identifier: "https://api.example.com",
				name: "Example API",
				scopes: [{ name: "read" }],
			});

			let resources = await Resource.list(db);
			let resource = await Resource.show(db, resources[0]!.id);

			expect(resource).not.toBeNull();
			expect(resource?.identifier).toBe("https://api.example.com");
		});

		test("returns null for non-existent id", async () => {
			let resource = await Resource.show(db, "non-existent-id");
			expect(resource).toBeNull();
		});
	});

	describe("findByIdentifier", () => {
		test("returns resource by identifier", async () => {
			await Resource.create(db, {
				identifier: "https://api.example.com",
				name: "Example API",
				scopes: [{ name: "read" }],
			});

			let resource = await Resource.findByIdentifier(db, "https://api.example.com");
			expect(resource).not.toBeNull();
			expect(resource?.name).toBe("Example API");
		});

		test("returns null for non-existent identifier", async () => {
			let resource = await Resource.findByIdentifier(db, "https://nonexistent.com");
			expect(resource).toBeNull();
		});
	});

	describe("list", () => {
		test("returns all resources", async () => {
			await Resource.create(db, {
				identifier: "https://api1.example.com",
				name: "API 1",
				scopes: [{ name: "read" }],
			});
			await Resource.create(db, {
				identifier: "https://api2.example.com",
				name: "API 2",
				scopes: [{ name: "write" }],
			});

			let resources = await Resource.list(db);
			expect(resources).toHaveLength(2);
		});

		test("returns empty array when no resources", async () => {
			let resources = await Resource.list(db);
			expect(resources).toHaveLength(0);
		});
	});

	describe("update", () => {
		test("updates resource properties", async () => {
			await Resource.create(db, {
				identifier: "https://api.example.com",
				name: "Original Name",
				scopes: [{ name: "read" }],
			});

			let resources = await Resource.list(db);
			let resourceId = resources[0]!.id;

			await Resource.update(db, resourceId, {
				name: "Updated Name",
				description: "New description",
			});

			let resource = await Resource.show(db, resourceId);
			expect(resource?.name).toBe("Updated Name");
			expect(resource?.description).toBe("New description");
			expect(resource?.identifier).toBe("https://api.example.com");
		});

		test("updates scopes", async () => {
			await Resource.create(db, {
				identifier: "https://api.example.com",
				name: "API",
				scopes: [{ name: "read" }],
			});

			let resources = await Resource.list(db);
			let resourceId = resources[0]!.id;

			await Resource.update(db, resourceId, {
				scopes: [{ name: "read" }, { name: "write" }, { name: "delete" }],
			});

			let resource = await Resource.show(db, resourceId);
			let scopes = Resource.parseScopes(resource!);
			expect(scopes).toHaveLength(3);
		});

		test("sets description to null", async () => {
			await Resource.create(db, {
				identifier: "https://api.example.com",
				name: "API",
				description: "Original description",
				scopes: [{ name: "read" }],
			});

			let resources = await Resource.list(db);
			let resourceId = resources[0]!.id;

			await Resource.update(db, resourceId, { description: null });

			let resource = await Resource.show(db, resourceId);
			expect(resource?.description).toBeNull();
		});

		test("throws RecordNotFoundError for non-existent resource", async () => {
			expect(Resource.update(db, "non-existent", { name: "New Name" })).rejects.toThrow("record");
		});
	});

	describe("destroy", () => {
		test("deletes the resource", async () => {
			await Resource.create(db, {
				identifier: "https://api.example.com",
				name: "API",
				scopes: [{ name: "read" }],
			});

			let resources = await Resource.list(db);
			let resourceId = resources[0]!.id;

			await Resource.destroy(db, resourceId);

			let resource = await Resource.show(db, resourceId);
			expect(resource).toBeNull();
		});

		test("throws RecordNotFoundError for non-existent resource", async () => {
			expect(Resource.destroy(db, "non-existent")).rejects.toThrow("record");
		});
	});

	describe("parseScopes", () => {
		test("parses scopes from JSON string", async () => {
			await Resource.create(db, {
				identifier: "https://api.example.com",
				name: "API",
				scopes: [{ name: "read", description: "Read access" }, { name: "write" }],
			});

			let resources = await Resource.list(db);
			let scopes = Resource.parseScopes(resources[0]!);

			expect(scopes).toEqual([{ name: "read", description: "Read access" }, { name: "write" }]);
		});
	});
});
