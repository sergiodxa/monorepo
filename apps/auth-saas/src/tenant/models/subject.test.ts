import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { createDatabase } from "remix/data-table";

import { createBunSqliteDatabaseAdapter } from "~/test/db";

import Subject from "./subject";

describe("Subject", () => {
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

	describe("register", () => {
		test("creates a new subject", async () => {
			let subject = await Subject.register(db, {
				email: "test@example.com",
				username: "testuser",
			});

			expect(subject.id).toBeDefined();
			expect(subject.email).toBe("test@example.com");
			expect(subject.username).toBe("testuser");
			expect(subject.email_verified_at).toBeNull();
			expect(subject.role).toBe("user");
		});

		test("creates subjects with unique emails", async () => {
			await Subject.register(db, {
				email: "test@example.com",
				username: "user1",
			});

			// Should throw on duplicate email
			await expect(
				Subject.register(db, {
					email: "test@example.com",
					username: "user2",
				}),
			).rejects.toThrow();
		});
	});

	describe("verifyEmail", () => {
		test("sets email_verified_at", async () => {
			let subject = await Subject.register(db, {
				email: "test@example.com",
				username: "testuser",
			});

			expect(subject.email_verified_at).toBeNull();

			await Subject.verifyEmail(db, subject.id);

			let updated = await Subject.show(db, subject.id);
			expect(updated?.email_verified_at).not.toBeNull();
		});
	});

	describe("findByEmail", () => {
		test("returns subject by email", async () => {
			await Subject.register(db, {
				email: "test@example.com",
				username: "testuser",
			});

			let found = await Subject.findByEmail(db, "test@example.com");
			expect(found).not.toBeNull();
			expect(found?.email).toBe("test@example.com");
		});

		test("returns null for non-existent email", async () => {
			let found = await Subject.findByEmail(db, "notfound@example.com");
			expect(found).toBeNull();
		});
	});

	describe("update", () => {
		test("updates display name and avatar", async () => {
			let subject = await Subject.register(db, {
				email: "test@example.com",
				username: "testuser",
			});

			await Subject.update(db, subject.id, {
				displayName: "Test User",
				avatarUrl: "https://example.com/avatar.png",
			});

			let updated = await Subject.show(db, subject.id);
			expect(updated?.display_name).toBe("Test User");
			expect(updated?.avatar_url).toBe("https://example.com/avatar.png");
		});
	});

	describe("destroy", () => {
		test("deletes subject", async () => {
			let subject = await Subject.register(db, {
				email: "test@example.com",
				username: "testuser",
			});

			await Subject.destroy(db, subject.id);

			let found = await Subject.show(db, subject.id);
			expect(found).toBeNull();
		});
	});

	describe("list", () => {
		test("returns all subjects", async () => {
			await Subject.register(db, { email: "user1@example.com", username: "user1" });
			await Subject.register(db, { email: "user2@example.com", username: "user2" });

			let subjects = await Subject.list(db);
			expect(subjects).toHaveLength(2);
		});
	});
});
