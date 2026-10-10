/**
 * Pins how a login's profile reaches a local account: a returning subject updates its own
 * row, and a first login claims the account holding its email only when the provider
 * verified that address, so a stranger's sign-up can never take over an admin account.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { testDatabase } from "~/app/test/database";
import { bindModels } from "~/app/test/models";

import type { AuthProfile } from "./users";

import { UnverifiedEmailError } from "./users";

/** The address the existing admin account is registered under. */
const ADMIN_EMAIL = "sergio@example.com";

/** The subject the admin signs in as. */
const ADMIN_SUBJECT = "subject-admin";

/** A profile for `subjectId`, claiming `email` with the given verification. */
function profileOf(subjectId: string, email: string, emailVerified: boolean): AuthProfile {
	return {
		subjectId,
		email,
		emailVerified,
		avatar: "https://example.com/avatar.png",
		username: `user-${subjectId}`,
		displayName: "Someone",
	};
}

/** Creates the admin account a first login could try to claim. */
async function seedAdmin(db: Database, subjectId: string | undefined = ADMIN_SUBJECT) {
	return unwrap(
		await bindModels(db).users.create({
			subject_id: subjectId ?? null,
			role: "admin",
			email: ADMIN_EMAIL,
			avatar: "https://example.com/admin.png",
			username: "sergiodxa",
			display_name: "Sergio",
		}),
	);
}

describe("users.findOrCreateFromAuthProfile", () => {
	test("refuses an unverified email naming an existing admin account, leaving it untouched", async () => {
		let db = await testDatabase();
		let admin = await seedAdmin(db);

		let result = await bindModels(db).users.findOrCreateFromAuthProfile(
			profileOf("subject-stranger", ADMIN_EMAIL, false),
		);

		expect(isFailure(result) && result.error).toBeInstanceOf(UnverifiedEmailError);
		expect(await bindModels(db).users.find(admin.id)).toEqual(admin);
		expect(await bindModels(db).users.findBySubjectId("subject-stranger")).toBeNull();
	});

	test("refuses an unverified email naming an admin account no subject has linked yet", async () => {
		let db = await testDatabase();
		let admin = await seedAdmin(db, undefined);

		let result = await bindModels(db).users.findOrCreateFromAuthProfile(
			profileOf("subject-stranger", ADMIN_EMAIL, false),
		);

		expect(isFailure(result) && result.error).toBeInstanceOf(UnverifiedEmailError);
		expect(await bindModels(db).users.find(admin.id)).toEqual(admin);
	});

	test("links a first login to the account holding its verified email", async () => {
		let db = await testDatabase();
		let admin = await seedAdmin(db, undefined);

		let result = await bindModels(db).users.findOrCreateFromAuthProfile(
			profileOf("subject-new", ADMIN_EMAIL, true),
		);

		expect(isSuccess(result) && result.data.id).toBe(admin.id);
		expect(isSuccess(result) && result.data.subject_id).toBe("subject-new");
	});

	test("creates a guest for an unverified email no account holds", async () => {
		let db = await testDatabase();
		await seedAdmin(db);

		let result = await bindModels(db).users.findOrCreateFromAuthProfile(
			profileOf("subject-guest", "guest@example.com", false),
		);

		expect(isSuccess(result) && result.data.role).toBe("guest");
		expect(isSuccess(result) && result.data.subject_id).toBe("subject-guest");
	});

	test("signs a returning subject into its own account whatever the email's verification", async () => {
		let db = await testDatabase();
		let admin = await seedAdmin(db);

		let result = await bindModels(db).users.findOrCreateFromAuthProfile(
			profileOf(ADMIN_SUBJECT, ADMIN_EMAIL, false),
		);

		expect(isSuccess(result) && result.data.id).toBe(admin.id);
		expect(isSuccess(result) && result.data.role).toBe("admin");
	});
});
