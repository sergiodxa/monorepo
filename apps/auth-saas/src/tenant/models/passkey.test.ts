import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { createDatabase } from "remix/data-table";

import { createBunSqliteDatabaseAdapter } from "~/test/db";
import { createSubject } from "~/test/fixtures";

import Passkey from "./passkey";

describe("Passkey", () => {
	let sqliteDb: Database;
	let db: ReturnType<typeof createDatabase>;

	beforeEach(async () => {
		sqliteDb = new Database(":memory:");
		let { default: migration0001 } = await import("../migrations/0001-init.sql?raw");
		let { default: migration0006 } =
			await import("../migrations/0006-add-passkey-credential-id.sql?raw");
		sqliteDb.run(migration0001);
		sqliteDb.run(migration0006);
		let adapter = createBunSqliteDatabaseAdapter(sqliteDb);
		db = createDatabase(adapter);
	});

	afterEach(() => {
		sqliteDb.close();
	});

	describe("create", () => {
		test("creates a passkey with required fields", async () => {
			let subject = await createSubject(db, { verified: true });

			await Passkey.create(db, {
				subjectId: subject.id,
				credentialId: "test-credential-id-123",
				publicKey: "test-public-key-123",
				counter: 0,
			});

			let passkeys = await Passkey.listBySubject(db, subject.id);
			expect(passkeys).toHaveLength(1);
			expect(passkeys[0]!.id).toBeString();
			expect(passkeys[0]!.subject_id).toBe(subject.id);
			expect(passkeys[0]!.public_key).toBe("test-public-key-123");
			expect(passkeys[0]!.counter).toBe(0);
			expect(passkeys[0]!.device_type).toBeNull();
			expect(passkeys[0]!.name).toBeNull();
			expect(passkeys[0]!.last_used_at).toBeNull();
		});

		test("creates a passkey with all fields", async () => {
			let subject = await createSubject(db, { verified: true });

			await Passkey.create(db, {
				subjectId: subject.id,
				credentialId: "test-credential-id-456",
				publicKey: "test-public-key-456",
				counter: 5,
				deviceType: "singleDevice",
				backedUp: true,
				transports: JSON.stringify(["internal", "hybrid"]),
				name: "My MacBook",
			});

			let passkeys = await Passkey.listBySubject(db, subject.id);
			expect(passkeys[0]!.device_type).toBe("singleDevice");
			expect(Boolean(passkeys[0]!.backed_up)).toBe(true);
			expect(passkeys[0]!.transports).toBe('["internal","hybrid"]');
			expect(passkeys[0]!.name).toBe("My MacBook");
		});
	});

	describe("show", () => {
		test("returns passkey by id", async () => {
			let subject = await createSubject(db, { verified: true });
			await Passkey.create(db, {
				subjectId: subject.id,
				credentialId: "test-cred-show",
				publicKey: "test-key",
				counter: 0,
			});

			let passkeys = await Passkey.listBySubject(db, subject.id);
			let passkey = await Passkey.show(db, passkeys[0]!.id);
			expect(passkey).not.toBeNull();
			expect(passkey?.public_key).toBe("test-key");
		});

		test("returns null for non-existent id", async () => {
			let passkey = await Passkey.show(db, "non-existent-id");
			expect(passkey).toBeNull();
		});
	});

	describe("listBySubject", () => {
		test("returns passkeys for a specific subject", async () => {
			let subject1 = await createSubject(db, { verified: true });
			let subject2 = await createSubject(db, { verified: true });

			await Passkey.create(db, {
				subjectId: subject1.id,
				credentialId: "cred-1",
				publicKey: "key-1",
				counter: 0,
				name: "Passkey 1",
			});
			await Passkey.create(db, {
				subjectId: subject1.id,
				credentialId: "cred-2",
				publicKey: "key-2",
				counter: 0,
				name: "Passkey 2",
			});
			await Passkey.create(db, {
				subjectId: subject2.id,
				credentialId: "cred-3",
				publicKey: "key-3",
				counter: 0,
			});

			let subject1Passkeys = await Passkey.listBySubject(db, subject1.id);
			expect(subject1Passkeys).toHaveLength(2);
			expect(subject1Passkeys.every((p) => p.subject_id === subject1.id)).toBe(true);

			let subject2Passkeys = await Passkey.listBySubject(db, subject2.id);
			expect(subject2Passkeys).toHaveLength(1);
		});

		test("returns empty array when subject has no passkeys", async () => {
			let subject = await createSubject(db, { verified: true });
			let passkeys = await Passkey.listBySubject(db, subject.id);
			expect(passkeys).toHaveLength(0);
		});
	});

	describe("updateCounter", () => {
		test("updates the counter and last_used_at", async () => {
			let subject = await createSubject(db, { verified: true });
			await Passkey.create(db, {
				subjectId: subject.id,
				credentialId: "test-cred-counter",
				publicKey: "test-key",
				counter: 5,
			});

			let passkeys = await Passkey.listBySubject(db, subject.id);
			let passkeyId = passkeys[0]!.id;

			await Passkey.updateCounter(db, passkeyId, 10);

			let passkey = await Passkey.show(db, passkeyId);
			expect(passkey?.counter).toBe(10);
			expect(passkey?.last_used_at).not.toBeNull();
		});

		test("throws RecordNotFoundError for non-existent passkey", async () => {
			await expect(Passkey.updateCounter(db, "non-existent", 5)).rejects.toThrow("record");
		});
	});

	describe("rename", () => {
		test("updates the passkey name", async () => {
			let subject = await createSubject(db, { verified: true });
			await Passkey.create(db, {
				subjectId: subject.id,
				credentialId: "test-cred-rename",
				publicKey: "test-key",
				counter: 0,
				name: "Old Name",
			});

			let passkeys = await Passkey.listBySubject(db, subject.id);
			let passkeyId = passkeys[0]!.id;

			await Passkey.rename(db, passkeyId, "New Name");

			let passkey = await Passkey.show(db, passkeyId);
			expect(passkey?.name).toBe("New Name");
		});

		test("throws RecordNotFoundError for non-existent passkey", async () => {
			await expect(Passkey.rename(db, "non-existent", "Name")).rejects.toThrow("record");
		});
	});

	describe("destroy", () => {
		test("deletes the passkey", async () => {
			let subject = await createSubject(db, { verified: true });
			await Passkey.create(db, {
				subjectId: subject.id,
				credentialId: "test-cred-destroy",
				publicKey: "test-key",
				counter: 0,
			});

			let passkeys = await Passkey.listBySubject(db, subject.id);
			let passkeyId = passkeys[0]!.id;

			await Passkey.destroy(db, passkeyId);

			let passkey = await Passkey.show(db, passkeyId);
			expect(passkey).toBeNull();
		});

		test("throws RecordNotFoundError for non-existent passkey", async () => {
			await expect(Passkey.destroy(db, "non-existent")).rejects.toThrow("record");
		});
	});
});
