/**
 * Unit tests for the team settings, membership, and lifecycle form validators:
 * update/delete a team (including the typed "DELETE" confirmation literal),
 * remove/promote/demote a member, create an additional team, and leave a team.
 *
 * Exercises the schemas directly via `remix/data-schema`'s `parseSafe()` with real
 * `FormData`, not `@pkg/validate`'s `validate()`: `validate()` normalizes `FormData`
 * into a plain object before handing it to the schema, but these are `f.object(...)`
 * form-data schemas that only accept the raw `FormData`/`URLSearchParams` instance, so
 * every call through `validate()` fails before the field-level rules ever run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import {
	ChangeRoleSchema,
	CreateTeamSchema,
	DeleteTeamSchema,
	LeaveTeamSchema,
	RemoveMemberSchema,
	UpdateTeamSchema,
} from "~/app/http/validators/team";

describe("UpdateTeamSchema", () => {
	test("accepts a valid name without a logo", () => {
		let formData = new FormData();
		formData.set("name", "Acme Inc");
		expect(s.parseSafe(UpdateTeamSchema, formData).success).toBe(true);
	});

	test("accepts a valid name with a logo", () => {
		let formData = new FormData();
		formData.set("name", "Acme Inc");
		formData.set("logo", "https://example.com/logo.png");
		let result = s.parseSafe(UpdateTeamSchema, formData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.logo).toBe("https://example.com/logo.png");
		}
	});

	test("leaves logo undefined when omitted, since it is optional", () => {
		let formData = new FormData();
		formData.set("name", "Acme Inc");
		let result = s.parseSafe(UpdateTeamSchema, formData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.logo).toBeUndefined();
		}
	});

	test("rejects an empty name", () => {
		let formData = new FormData();
		formData.set("name", "");
		expect(s.parseSafe(UpdateTeamSchema, formData).success).toBe(false);
	});

	test("rejects a name longer than 255 characters", () => {
		let formData = new FormData();
		formData.set("name", "a".repeat(256));
		expect(s.parseSafe(UpdateTeamSchema, formData).success).toBe(false);
	});
});

describe("DeleteTeamSchema", () => {
	test("accepts the exact literal confirmation 'DELETE'", () => {
		let formData = new FormData();
		formData.set("confirmation", "DELETE");
		expect(s.parseSafe(DeleteTeamSchema, formData).success).toBe(true);
	});

	test("rejects a lowercase confirmation", () => {
		let formData = new FormData();
		formData.set("confirmation", "delete");
		expect(s.parseSafe(DeleteTeamSchema, formData).success).toBe(false);
	});

	test("rejects a missing confirmation field", () => {
		expect(s.parseSafe(DeleteTeamSchema, new FormData()).success).toBe(false);
	});
});

describe("RemoveMemberSchema", () => {
	test("accepts a valid subject_id and email", () => {
		let formData = new FormData();
		formData.set("subject_id", "user_1");
		formData.set("email", "member@example.com");
		expect(s.parseSafe(RemoveMemberSchema, formData).success).toBe(true);
	});

	test("does not require the email field to look like an email address", () => {
		let formData = new FormData();
		formData.set("subject_id", "user_1");
		formData.set("email", "not-an-email-but-still-a-string");
		expect(s.parseSafe(RemoveMemberSchema, formData).success).toBe(true);
	});

	test("rejects a missing subject_id", () => {
		let formData = new FormData();
		formData.set("email", "member@example.com");
		expect(s.parseSafe(RemoveMemberSchema, formData).success).toBe(false);
	});

	test("rejects a missing email", () => {
		let formData = new FormData();
		formData.set("subject_id", "user_1");
		expect(s.parseSafe(RemoveMemberSchema, formData).success).toBe(false);
	});
});

describe("ChangeRoleSchema", () => {
	test.each(["member", "admin"])("accepts role '%s'", (role) => {
		let formData = new FormData();
		formData.set("subject_id", "user_1");
		formData.set("role", role);
		expect(s.parseSafe(ChangeRoleSchema, formData).success).toBe(true);
	});

	test("rejects an unknown role", () => {
		let formData = new FormData();
		formData.set("subject_id", "user_1");
		formData.set("role", "owner");
		expect(s.parseSafe(ChangeRoleSchema, formData).success).toBe(false);
	});

	test("rejects a missing subject_id", () => {
		let formData = new FormData();
		formData.set("role", "admin");
		expect(s.parseSafe(ChangeRoleSchema, formData).success).toBe(false);
	});
});

describe("CreateTeamSchema", () => {
	test("accepts a valid name", () => {
		let formData = new FormData();
		formData.set("name", "Acme Inc");
		expect(s.parseSafe(CreateTeamSchema, formData).success).toBe(true);
	});

	test("rejects an empty name", () => {
		let formData = new FormData();
		formData.set("name", "");
		expect(s.parseSafe(CreateTeamSchema, formData).success).toBe(false);
	});

	test("rejects a missing name field", () => {
		expect(s.parseSafe(CreateTeamSchema, new FormData()).success).toBe(false);
	});
});

describe("LeaveTeamSchema", () => {
	test("accepts a valid team_id", () => {
		let formData = new FormData();
		formData.set("team_id", "team_1");
		expect(s.parseSafe(LeaveTeamSchema, formData).success).toBe(true);
	});

	test("rejects a missing team_id", () => {
		expect(s.parseSafe(LeaveTeamSchema, new FormData()).success).toBe(false);
	});
});
