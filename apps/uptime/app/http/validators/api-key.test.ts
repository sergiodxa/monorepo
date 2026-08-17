/**
 * Unit tests for the create/delete API-key form validators: the `scopes` checkbox
 * group, the "select at least one scope" refinement, and the optional `expires_at`
 * date parsing.
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

import { CreateApiKeySchema, DeleteApiKeySchema } from "~/app/http/validators/api-key";

describe("CreateApiKeySchema", () => {
	test("accepts a valid name with one scope", () => {
		let formData = new FormData();
		formData.set("name", "CI key");
		formData.append("scopes", "monitors:read");
		let result = s.parseSafe(CreateApiKeySchema, formData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.scopes).toEqual(["monitors:read"]);
		}
	});

	test("accepts multiple checked scopes", () => {
		let formData = new FormData();
		formData.set("name", "CI key");
		formData.append("scopes", "monitors:read");
		formData.append("scopes", "monitors:write");
		let result = s.parseSafe(CreateApiKeySchema, formData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.scopes).toEqual(["monitors:read", "monitors:write"]);
		}
	});

	test("rejects an empty name", () => {
		let formData = new FormData();
		formData.set("name", "");
		formData.append("scopes", "monitors:read");
		expect(s.parseSafe(CreateApiKeySchema, formData).success).toBe(false);
	});

	test("rejects a name longer than 255 characters", () => {
		let formData = new FormData();
		formData.set("name", "a".repeat(256));
		formData.append("scopes", "monitors:read");
		expect(s.parseSafe(CreateApiKeySchema, formData).success).toBe(false);
	});

	test("rejects a scope that is not in the known scope list", () => {
		let formData = new FormData();
		formData.set("name", "CI key");
		formData.append("scopes", "not-a-real-scope");
		expect(s.parseSafe(CreateApiKeySchema, formData).success).toBe(false);
	});

	test("rejects a submission with no scopes checked at all", () => {
		let formData = new FormData();
		formData.set("name", "CI key");
		let result = s.parseSafe(CreateApiKeySchema, formData);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.issues[0]?.message).toBe("Select at least one scope.");
		}
	});

	test("parses a valid expires_at date into a number", () => {
		let formData = new FormData();
		formData.set("name", "CI key");
		formData.append("scopes", "monitors:read");
		formData.set("expires_at", "2026-12-31");
		let result = s.parseSafe(CreateApiKeySchema, formData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(typeof result.value.expires_at).toBe("number");
			expect(Number.isFinite(result.value.expires_at)).toBe(true);
		}
	});

	test("leaves expires_at null when left blank", () => {
		let formData = new FormData();
		formData.set("name", "CI key");
		formData.append("scopes", "monitors:read");
		let result = s.parseSafe(CreateApiKeySchema, formData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.expires_at).toBeNull();
		}
	});

	test("leaves expires_at null when omitted entirely, since it is optional", () => {
		let formData = new FormData();
		formData.set("name", "CI key");
		formData.append("scopes", "monitors:read");
		formData.delete("expires_at");
		let result = s.parseSafe(CreateApiKeySchema, formData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.expires_at).toBeNull();
		}
	});
});

describe("DeleteApiKeySchema", () => {
	test("accepts a valid api_key_id", () => {
		let formData = new FormData();
		formData.set("api_key_id", "key_1");
		expect(s.parseSafe(DeleteApiKeySchema, formData).success).toBe(true);
	});

	test("rejects a missing api_key_id", () => {
		expect(s.parseSafe(DeleteApiKeySchema, new FormData()).success).toBe(false);
	});
});
