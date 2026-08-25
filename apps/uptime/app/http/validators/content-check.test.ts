/**
 * Unit tests for the monitor content-check form validators: the `type` enum,
 * the regex-rejection `.refine()`, and the `delete-content-check` id-pair
 * schema. Exercised via `remix/data-schema`'s `parseSafe()` with real
 * `FormData`, since `f.object(...)` schemas parse the raw
 * `FormData`/`URLSearchParams` instance directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import {
	CreateContentCheckSchema,
	DeleteContentCheckSchema,
} from "~/app/http/validators/content-check";

describe("CreateContentCheckSchema", () => {
	test("accepts a valid 'contains' check", () => {
		let formData = new FormData();
		formData.set("monitor_id", "mon_1");
		formData.set("type", "contains");
		formData.set("value", "Welcome");
		expect(s.parseSafe(CreateContentCheckSchema, formData).success).toBe(true);
	});

	test("accepts a valid 'not_contains' check", () => {
		let formData = new FormData();
		formData.set("monitor_id", "mon_1");
		formData.set("type", "not_contains");
		formData.set("value", "Error");
		expect(s.parseSafe(CreateContentCheckSchema, formData).success).toBe(true);
	});

	test("accepts a valid regular expression when type is 'regex'", () => {
		let formData = new FormData();
		formData.set("monitor_id", "mon_1");
		formData.set("type", "regex");
		formData.set("value", "^\\d{3}-\\d{4}$");
		expect(s.parseSafe(CreateContentCheckSchema, formData).success).toBe(true);
	});

	test("rejects an invalid regular expression when type is 'regex'", () => {
		let formData = new FormData();
		formData.set("monitor_id", "mon_1");
		formData.set("type", "regex");
		formData.set("value", "(unterminated");
		let result = s.parseSafe(CreateContentCheckSchema, formData);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.issues[0]?.message).toBe("Invalid regular expression");
		}
	});

	test("does not attempt to compile the value as a regex for non-regex types", () => {
		let formData = new FormData();
		formData.set("monitor_id", "mon_1");
		formData.set("type", "contains");
		formData.set("value", "(unterminated");
		expect(s.parseSafe(CreateContentCheckSchema, formData).success).toBe(true);
	});

	test("rejects an unknown type", () => {
		let formData = new FormData();
		formData.set("monitor_id", "mon_1");
		formData.set("type", "starts_with");
		formData.set("value", "Welcome");
		expect(s.parseSafe(CreateContentCheckSchema, formData).success).toBe(false);
	});

	test("rejects an empty value", () => {
		let formData = new FormData();
		formData.set("monitor_id", "mon_1");
		formData.set("type", "contains");
		formData.set("value", "");
		expect(s.parseSafe(CreateContentCheckSchema, formData).success).toBe(false);
	});

	test("rejects a missing monitor_id", () => {
		let formData = new FormData();
		formData.set("type", "contains");
		formData.set("value", "Welcome");
		expect(s.parseSafe(CreateContentCheckSchema, formData).success).toBe(false);
	});

	test("defaults case_sensitive to false when omitted", () => {
		let formData = new FormData();
		formData.set("monitor_id", "mon_1");
		formData.set("type", "contains");
		formData.set("value", "Welcome");
		let result = s.parseSafe(CreateContentCheckSchema, formData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.case_sensitive).toBe(false);
		}
	});

	test("coerces case_sensitive from a 'true' string", () => {
		let formData = new FormData();
		formData.set("monitor_id", "mon_1");
		formData.set("type", "contains");
		formData.set("value", "Welcome");
		formData.set("case_sensitive", "true");
		let result = s.parseSafe(CreateContentCheckSchema, formData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.case_sensitive).toBe(true);
		}
	});
});

describe("DeleteContentCheckSchema", () => {
	test("accepts a valid monitor_id/content_check_id pair", () => {
		let formData = new FormData();
		formData.set("monitor_id", "mon_1");
		formData.set("content_check_id", "check_1");
		expect(s.parseSafe(DeleteContentCheckSchema, formData).success).toBe(true);
	});

	test("rejects a missing content_check_id", () => {
		let formData = new FormData();
		formData.set("monitor_id", "mon_1");
		expect(s.parseSafe(DeleteContentCheckSchema, formData).success).toBe(false);
	});

	test("rejects a missing monitor_id", () => {
		let formData = new FormData();
		formData.set("content_check_id", "check_1");
		expect(s.parseSafe(DeleteContentCheckSchema, formData).success).toBe(false);
	});
});
