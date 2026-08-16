/**
 * Verifies admin-role assignment in {@link User.findOrCreateFromAuthProfile}: the
 * allowlist always grants admin, the first-admin bootstrap is opt-in, and disabling
 * it stops a non-allowlisted user from claiming admin on a fresh (adminless) tenant.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { beforeEach, describe, expect, test } from "bun:test";

import { Database } from "remix/data-table";

import { Role } from "../../roles/models/role";
import { createTestDatabase } from "../../shared/test/db";

import type { AuthProfile } from "./user";

import { User } from "./user";

/** Builds an OIDC {@link AuthProfile} with sensible defaults for tests. */
function profile(overrides: Partial<AuthProfile> = {}): AuthProfile {
	return {
		subjectId: "sub-1",
		email: "user@example.test",
		avatar: "",
		username: "user",
		displayName: "User",
		...overrides,
	};
}

describe("User.findOrCreateFromAuthProfile admin assignment", () => {
	let db: Database;

	beforeEach(async () => {
		({ db } = await createTestDatabase());
	});

	test("bootstraps the first user as admin by default when no admin exists", async () => {
		let user = await User.findOrCreateFromAuthProfile(db, profile());
		expect(user.role_id).toBe(await Role.adminRoleId(db));
	});

	test("with bootstrapFirstAdmin=false a non-allowlisted first user is a reader, not admin", async () => {
		// The multi-tenant hole: a stray SSO user reaching a fresh (adminless) tenant.
		let user = await User.findOrCreateFromAuthProfile(db, profile(), {
			admins: ["owner@example.test"],
			bootstrapFirstAdmin: false,
		});
		expect(user.role_id).toBe(await Role.readerRoleId(db));
		expect(user.role_id).not.toBe(await Role.adminRoleId(db));
	});

	test("the email allowlist grants admin even with bootstrapFirstAdmin=false", async () => {
		let user = await User.findOrCreateFromAuthProfile(
			db,
			profile({ email: "owner@example.test" }),
			{
				admins: ["owner@example.test"],
				bootstrapFirstAdmin: false,
			},
		);
		expect(user.role_id).toBe(await Role.adminRoleId(db));
	});

	test("the subject-id allowlist grants admin even with bootstrapFirstAdmin=false", async () => {
		let user = await User.findOrCreateFromAuthProfile(db, profile({ subjectId: "owner-sub" }), {
			admins: ["owner-sub"],
			bootstrapFirstAdmin: false,
		});
		expect(user.role_id).toBe(await Role.adminRoleId(db));
	});
});
