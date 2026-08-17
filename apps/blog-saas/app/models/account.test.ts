/**
 * Unit tests for the `Account` control-plane model: the find-or-create upsert from an
 * IdP profile (insert vs. update, display-name preservation), Polar customer-id
 * mutation, and the subject/id lookups, against an in-memory SQLite database.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { type TestDatabase, createTestDatabase } from "~/app/test/db";

import Account from "./account";

let harness: TestDatabase;

beforeEach(() => {
	harness = createTestDatabase();
});

afterEach(() => {
	harness.sqliteDb.close();
});

describe("Account.findOrCreateFromProfile", () => {
	test("creates a new account for an unseen subject", async () => {
		let account = await Account.findOrCreateFromProfile(harness.db, {
			subject: "auth0|123",
			email: "jane@example.com",
			displayName: "Jane",
		});

		expect(account.oidc_subject).toBe("auth0|123");
		expect(account.email).toBe("jane@example.com");
		expect(account.display_name).toBe("Jane");
		expect(account.polar_customer_id).toBeNull();
	});

	test("defaults a missing display name to null on create", async () => {
		let account = await Account.findOrCreateFromProfile(harness.db, {
			subject: "auth0|123",
			email: "jane@example.com",
		});

		expect(account.display_name).toBeNull();
	});

	test("returns the existing account for a known subject rather than duplicating", async () => {
		let first = await Account.findOrCreateFromProfile(harness.db, {
			subject: "auth0|123",
			email: "jane@example.com",
		});

		let second = await Account.findOrCreateFromProfile(harness.db, {
			subject: "auth0|123",
			email: "jane.new@example.com",
		});

		expect(second.id).toBe(first.id);
	});

	test("refreshes the email on a subsequent login", async () => {
		await Account.findOrCreateFromProfile(harness.db, {
			subject: "auth0|123",
			email: "old@example.com",
		});

		let updated = await Account.findOrCreateFromProfile(harness.db, {
			subject: "auth0|123",
			email: "new@example.com",
		});

		expect(updated.email).toBe("new@example.com");
	});

	test("keeps the stored display name when a later login omits it", async () => {
		await Account.findOrCreateFromProfile(harness.db, {
			subject: "auth0|123",
			email: "jane@example.com",
			displayName: "Jane",
		});

		let updated = await Account.findOrCreateFromProfile(harness.db, {
			subject: "auth0|123",
			email: "jane@example.com",
		});

		expect(updated.display_name).toBe("Jane");
	});
});

describe("Account lookups", () => {
	test("findBySubject resolves an account by its IdP subject", async () => {
		await Account.findOrCreateFromProfile(harness.db, {
			subject: "auth0|abc",
			email: "jane@example.com",
		});

		let found = await Account.findBySubject(harness.db, "auth0|abc");

		expect(found?.oidc_subject).toBe("auth0|abc");
	});

	test("findById resolves an account by its primary key", async () => {
		let created = await Account.findOrCreateFromProfile(harness.db, {
			subject: "auth0|abc",
			email: "jane@example.com",
		});

		let found = await Account.findById(harness.db, created.id);

		expect(found?.id).toBe(created.id);
	});

	test("findBySubject returns null for an unknown subject", async () => {
		expect(await Account.findBySubject(harness.db, "nobody")).toBeNull();
	});
});

describe("Account.setPolarCustomerId", () => {
	test("sets the Polar customer id", async () => {
		let account = await Account.findOrCreateFromProfile(harness.db, {
			subject: "auth0|123",
			email: "jane@example.com",
		});

		await Account.setPolarCustomerId(harness.db, account.id, "cus_1");

		expect((await Account.findById(harness.db, account.id))?.polar_customer_id).toBe("cus_1");
	});

	test("clears the Polar customer id when passed null", async () => {
		let account = await Account.findOrCreateFromProfile(harness.db, {
			subject: "auth0|123",
			email: "jane@example.com",
		});
		await Account.setPolarCustomerId(harness.db, account.id, "cus_1");

		await Account.setPolarCustomerId(harness.db, account.id, null);

		expect((await Account.findById(harness.db, account.id))?.polar_customer_id).toBeNull();
	});
});
