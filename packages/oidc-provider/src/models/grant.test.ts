import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { createDatabase } from "remix/data-table";

import { createBunSqliteDatabaseAdapter } from "../test/db";
import { createClient, createSubject } from "../test/fixtures";

import Grant from "./grant";

describe("Grant", () => {
	let sqliteDb: Database;
	let db: ReturnType<typeof createDatabase>;

	beforeEach(async () => {
		sqliteDb = new Database(":memory:");
		let { default: migration } = await import("../migrations/0001-init.sql?raw");
		sqliteDb.run(migration);
		let adapter = createBunSqliteDatabaseAdapter(sqliteDb);
		db = createDatabase(adapter);
	});

	afterEach(() => {
		sqliteDb.close();
	});

	describe("findOrCreate", () => {
		test("creates a new grant when none exists", async () => {
			let subject = await createSubject(db, { verified: true });
			let client = await createClient(db);

			let grant = await Grant.findOrCreate(db, subject.id, client.id);

			expect(grant).toBeDefined();
			expect(grant.subject_id).toBe(subject.id);
			expect(grant.client_id).toBe(client.id);
			expect(grant.scopes).toBeNull();
		});

		test("returns existing grant when one exists", async () => {
			let subject = await createSubject(db, { verified: true });
			let client = await createClient(db);

			let grant1 = await Grant.findOrCreate(db, subject.id, client.id);
			let grant2 = await Grant.findOrCreate(db, subject.id, client.id);

			expect(grant1.id).toBe(grant2.id);

			let grants = await Grant.list(db);
			expect(grants).toHaveLength(1);
		});

		test("creates separate grants for different subject-client pairs", async () => {
			let subject1 = await createSubject(db, { verified: true });
			let subject2 = await createSubject(db, { verified: true });
			let client = await createClient(db);

			await Grant.findOrCreate(db, subject1.id, client.id);
			await Grant.findOrCreate(db, subject2.id, client.id);

			let grants = await Grant.list(db);
			expect(grants).toHaveLength(2);
		});
	});

	describe("show", () => {
		test("returns grant by id", async () => {
			let subject = await createSubject(db, { verified: true });
			let client = await createClient(db);

			let created = await Grant.findOrCreate(db, subject.id, client.id);
			let grant = await Grant.show(db, created.id);

			expect(grant).not.toBeNull();
			expect(grant?.id).toBe(created.id);
		});

		test("returns null for non-existent id", async () => {
			let grant = await Grant.show(db, "non-existent-id");
			expect(grant).toBeNull();
		});
	});

	describe("list", () => {
		test("returns all grants", async () => {
			let subject = await createSubject(db, { verified: true });
			let client1 = await createClient(db, { name: "Client 1" });
			let client2 = await createClient(db, { name: "Client 2" });

			await Grant.findOrCreate(db, subject.id, client1.id);
			await Grant.findOrCreate(db, subject.id, client2.id);

			let grants = await Grant.list(db);
			expect(grants).toHaveLength(2);
		});

		test("returns empty array when no grants exist", async () => {
			let grants = await Grant.list(db);
			expect(grants).toHaveLength(0);
		});
	});

	describe("listBySubject", () => {
		test("returns grants for a specific subject", async () => {
			let subject1 = await createSubject(db, { verified: true });
			let subject2 = await createSubject(db, { verified: true });
			let client1 = await createClient(db, { name: "Client 1" });
			let client2 = await createClient(db, { name: "Client 2" });

			await Grant.findOrCreate(db, subject1.id, client1.id);
			await Grant.findOrCreate(db, subject1.id, client2.id);
			await Grant.findOrCreate(db, subject2.id, client1.id);

			let subject1Grants = await Grant.listBySubject(db, subject1.id);
			expect(subject1Grants).toHaveLength(2);
			expect(subject1Grants.every((g) => g.subject_id === subject1.id)).toBe(true);

			let subject2Grants = await Grant.listBySubject(db, subject2.id);
			expect(subject2Grants).toHaveLength(1);
		});

		test("returns empty array when subject has no grants", async () => {
			let subject = await createSubject(db, { verified: true });
			let grants = await Grant.listBySubject(db, subject.id);
			expect(grants).toHaveLength(0);
		});
	});

	describe("destroy", () => {
		test("deletes the grant", async () => {
			let subject = await createSubject(db, { verified: true });
			let client = await createClient(db);

			let grant = await Grant.findOrCreate(db, subject.id, client.id);
			await Grant.destroy(db, grant.id);

			let deleted = await Grant.show(db, grant.id);
			expect(deleted).toBeNull();
		});

		test("throws RecordNotFoundError for non-existent grant", async () => {
			await expect(Grant.destroy(db, "non-existent")).rejects.toThrow("record");
		});
	});
});
