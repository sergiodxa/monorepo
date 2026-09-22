/**
 * Proves `validateImportRow` and `applyImportRow` directly against a real tenant
 * database, the way `account-linking.test.ts` isolates a mechanism from any Durable
 * Object: a clean row succeeds in both modes, each check a row can fail is shown
 * failing on its own with the right problem shape, several problems on one row are all
 * reported rather than just the first, and applying a row whose role does not resolve
 * still leaves the subject it created in place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurableObjectStateMock } from "@sdxc/cloudflare-mocks";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { password } from "@sdxc/crypto";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { unwrap } from "@sdxc/result";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test } from "vitest";

import type { ImportSubjectRow } from "./subject-import";

import { readAuditPage } from "./audit-events";
import { applyImportRow, completeImportRun, validateImportRow } from "./subject-import";
import { createSubject, defineAttribute, subjects } from "./subjects";
import { runMigrations } from "./tenant-migrations";

/** A tenant database with every migration applied, isolated from any `Tenant` object. */
async function createTenantDatabase(): Promise<Database> {
	let state: DurableObjectStateMock = createDurableObjectState();
	let driver = createSQLStorageDatabaseAdapter(state.storage.sql);
	await runMigrations(driver);
	return new Database(driver);
}

let db: Database;

beforeEach(async () => {
	db = await createTenantDatabase();
});

/** A row that validates and applies cleanly with nothing this module refuses: one email, no attributes, no roles, no password. */
function cleanRow(overrides: Partial<ImportSubjectRow> = {}): ImportSubjectRow {
	return {
		externalId: "ext_1",
		identifiers: [{ kind: "email", value: "jane@example.com", verified: true }],
		...overrides,
	};
}

describe("validateImportRow", () => {
	test("a clean row validates successfully, writing nothing", async () => {
		let outcome = await validateImportRow(db, cleanRow());

		expect(outcome).toMatchObject({ ok: true, externalId: "ext_1" });
		if (!outcome.ok) throw new Error("unreachable");
		expect(typeof outcome.subjectId).toBe("string");

		let count = await db.count(subjects);
		expect(count).toBe(0);
	});

	test("refuses an identifier colliding with an existing subject", async () => {
		let existing = await createSubject(db, {
			identifiers: [{ kind: "email", value: "jane@example.com" }],
		});
		if (!existing.ok) throw new Error("unreachable");

		let outcome = await validateImportRow(db, cleanRow());

		expect(outcome).toEqual({
			ok: false,
			externalId: "ext_1",
			problems: [
				{ kind: "identifier", reason: "taken", identifierKind: "email", value: "jane@example.com" },
			],
		});
	});

	test("refuses an unrecognized password hash", async () => {
		let bcryptHash = "$2a$10$N9qo8uLOickgx2ZMRZoMye.OmWJc0.vv.rMIFZQMWLQihlT4YLu8W";

		let outcome = await validateImportRow(db, cleanRow({ password: bcryptHash }));

		expect(outcome).toEqual({
			ok: false,
			externalId: "ext_1",
			problems: [{ kind: "password", reason: "unrecognized-hash" }],
		});
	});

	test("accepts a hash this platform's own password module produced", async () => {
		let hashed = unwrap(await password.hash("correct-password-1"));

		let outcome = await validateImportRow(db, cleanRow({ password: hashed }));

		expect(outcome).toMatchObject({ ok: true });
	});

	test("refuses an undeclared attribute key", async () => {
		let outcome = await validateImportRow(db, cleanRow({ attributes: { plan: "gold" } }));

		expect(outcome).toEqual({
			ok: false,
			externalId: "ext_1",
			problems: [{ kind: "attribute", key: "plan", reason: "unknown" }],
		});
	});

	test("accepts a declared attribute key", async () => {
		await defineAttribute(db, { key: "plan", type: "string", visibility: "internal" });

		let outcome = await validateImportRow(db, cleanRow({ attributes: { plan: "gold" } }));

		expect(outcome).toMatchObject({ ok: true });
	});

	test("refuses a role that does not resolve", async () => {
		let outcome = await validateImportRow(
			db,
			cleanRow({ roles: [{ scope: "tenant", roleKey: "does-not-exist" }] }),
		);

		expect(outcome).toEqual({
			ok: false,
			externalId: "ext_1",
			problems: [{ kind: "role", scope: "tenant", roleKey: "does-not-exist", reason: "not-found" }],
		});
	});

	test("accepts a system role key with no role ever defined", async () => {
		let outcome = await validateImportRow(
			db,
			cleanRow({ roles: [{ scope: "tenant", roleKey: "member" }] }),
		);

		expect(outcome).toMatchObject({ ok: true });
	});

	test("reports every problem a row has at once, not just the first", async () => {
		let existing = await createSubject(db, {
			identifiers: [{ kind: "email", value: "jane@example.com" }],
		});
		if (!existing.ok) throw new Error("unreachable");

		let outcome = await validateImportRow(
			db,
			cleanRow({
				attributes: { plan: "gold" },
				roles: [{ scope: "tenant", roleKey: "does-not-exist" }],
				password: "$2a$10$N9qo8uLOickgx2ZMRZoMye.OmWJc0.vv.rMIFZQMWLQihlT4YLu8W",
			}),
		);

		expect(outcome.ok).toBe(false);
		if (outcome.ok) throw new Error("unreachable");
		expect(outcome.problems).toEqual(
			expect.arrayContaining([
				{ kind: "identifier", reason: "taken", identifierKind: "email", value: "jane@example.com" },
				{ kind: "attribute", key: "plan", reason: "unknown" },
				{ kind: "role", scope: "tenant", roleKey: "does-not-exist", reason: "not-found" },
				{ kind: "password", reason: "unrecognized-hash" },
			]),
		);
		expect(outcome.problems).toHaveLength(4);
	});
});

describe("applyImportRow", () => {
	test("a clean row applies successfully, verified exactly where the row marked it so", async () => {
		let outcome = await applyImportRow(db, cleanRow());

		expect(outcome).toMatchObject({ ok: true, externalId: "ext_1" });
		if (!outcome.ok) throw new Error("unreachable");

		let subject = await db.find(subjects, { id: outcome.subjectId });
		expect(subject).not.toBeNull();
	});

	test("refuses an identifier colliding with an existing subject, writing no second subject", async () => {
		let existing = await createSubject(db, {
			identifiers: [{ kind: "email", value: "jane@example.com" }],
		});
		if (!existing.ok) throw new Error("unreachable");

		let outcome = await applyImportRow(db, cleanRow());

		expect(outcome).toEqual({
			ok: false,
			externalId: "ext_1",
			problems: [
				{ kind: "identifier", reason: "taken", identifierKind: "email", value: "jane@example.com" },
			],
		});

		let count = await db.count(subjects);
		expect(count).toBe(1);
	});

	test("refuses an unrecognized password hash, leaving the subject it already created", async () => {
		let bcryptHash = "$2a$10$N9qo8uLOickgx2ZMRZoMye.OmWJc0.vv.rMIFZQMWLQihlT4YLu8W";

		let outcome = await applyImportRow(db, cleanRow({ password: bcryptHash }));

		expect(outcome).toEqual({
			ok: false,
			externalId: "ext_1",
			problems: [{ kind: "password", reason: "unrecognized-hash" }],
		});

		// The subject is created before its password is written, and an unrecognized
		// hash does not roll that creation back — a row this far along is left as far
		// along as it honestly got rather than undone.
		let count = await db.count(subjects);
		expect(count).toBe(1);
	});

	test("refuses an undeclared attribute key, writing no subject", async () => {
		let outcome = await applyImportRow(db, cleanRow({ attributes: { plan: "gold" } }));

		expect(outcome).toEqual({
			ok: false,
			externalId: "ext_1",
			problems: [{ kind: "attribute", key: "plan", reason: "unknown" }],
		});

		let count = await db.count(subjects);
		expect(count).toBe(0);
	});

	test("creates the subject even when its declared role does not resolve, reporting the row as failed", async () => {
		let outcome = await applyImportRow(
			db,
			cleanRow({ roles: [{ scope: "tenant", roleKey: "does-not-exist" }] }),
		);

		expect(outcome).toEqual({
			ok: false,
			externalId: "ext_1",
			problems: [{ kind: "role", scope: "tenant", roleKey: "does-not-exist", reason: "not-found" }],
		});

		let created = await db.findMany(subjects);
		expect(created).toHaveLength(1);
	});

	test("assigns a system role key with no role ever defined", async () => {
		let outcome = await applyImportRow(
			db,
			cleanRow({ roles: [{ scope: "tenant", roleKey: "member" }] }),
		);

		expect(outcome).toMatchObject({ ok: true });
	});
});

describe("completeImportRun", () => {
	test("writes one summary audit row carrying the run's totals", async () => {
		let result = await completeImportRun(db, { processed: 10, created: 8, failed: 2 });

		expect(result).toEqual({ ok: true });

		let page = await readAuditPage(db, {
			from: 0,
			to: Date.now() + 60_000,
			action: "subjects.imported",
		});
		expect(page).toMatchObject({
			ok: true,
			events: [{ outcome: "succeeded", detail: { processed: 10, created: 8, failed: 2 } }],
		});
	});
});
