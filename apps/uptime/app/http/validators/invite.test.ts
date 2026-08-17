/**
 * Unit tests for the create/revoke invite form validators: the `email` format check
 * and the `revoke-invite` id schema.
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

import { describe, expect, test } from "vitest";

import * as s from "remix/data-schema";

import { CreateInviteSchema, RevokeInviteSchema } from "~/app/http/validators/invite";

describe("CreateInviteSchema", () => {
	test("accepts a valid email", () => {
		let formData = new FormData();
		formData.set("email", "friend@example.com");
		expect(s.parseSafe(CreateInviteSchema, formData).success).toBe(true);
	});

	test("rejects a malformed email", () => {
		let formData = new FormData();
		formData.set("email", "not-an-email");
		expect(s.parseSafe(CreateInviteSchema, formData).success).toBe(false);
	});

	test("rejects an empty email", () => {
		let formData = new FormData();
		formData.set("email", "");
		expect(s.parseSafe(CreateInviteSchema, formData).success).toBe(false);
	});

	test("rejects a missing email field", () => {
		expect(s.parseSafe(CreateInviteSchema, new FormData()).success).toBe(false);
	});
});

describe("RevokeInviteSchema", () => {
	test("accepts a valid invite_id", () => {
		let formData = new FormData();
		formData.set("invite_id", "invite_1");
		expect(s.parseSafe(RevokeInviteSchema, formData).success).toBe(true);
	});

	test("rejects a missing invite_id", () => {
		expect(s.parseSafe(RevokeInviteSchema, new FormData()).success).toBe(false);
	});
});
