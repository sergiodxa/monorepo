/**
 * Unit tests for the HTTP monitor create/update web-form validators: the required
 * `url` format check, the `location_hint` enum and its default, and the
 * `interval_seconds`/`expected_status` numeric bounds. Method/timeout/degraded-threshold
 * aren't fields on these schemas — see `app/http/validators/monitor.ts`'s docstring.
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

import { CreateMonitorSchema, UpdateMonitorSchema } from "~/app/http/validators/monitor";

function baseFormData(overrides: Record<string, string> = {}): FormData {
	let formData = new FormData();
	formData.set("name", "Homepage");
	formData.set("url", "https://example.com");
	for (let [key, value] of Object.entries(overrides)) formData.set(key, value);
	return formData;
}

describe("CreateMonitorSchema", () => {
	test("accepts valid required fields alone", () => {
		let result = s.parseSafe(CreateMonitorSchema, baseFormData());
		expect(result.success).toBe(true);
	});

	test("rejects an empty name", () => {
		expect(s.parseSafe(CreateMonitorSchema, baseFormData({ name: "" })).success).toBe(false);
	});

	test("rejects a malformed url", () => {
		expect(s.parseSafe(CreateMonitorSchema, baseFormData({ url: "not a url" })).success).toBe(
			false,
		);
	});

	test("rejects a missing url", () => {
		let formData = baseFormData();
		formData.delete("url");
		expect(s.parseSafe(CreateMonitorSchema, formData).success).toBe(false);
	});

	test("defaults expected_status to 200 when omitted", () => {
		let result = s.parseSafe(CreateMonitorSchema, baseFormData());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.expected_status).toBe(200);
		}
	});

	test("rejects an expected_status outside 100-599", () => {
		expect(s.parseSafe(CreateMonitorSchema, baseFormData({ expected_status: "99" })).success).toBe(
			false,
		);
		expect(s.parseSafe(CreateMonitorSchema, baseFormData({ expected_status: "600" })).success).toBe(
			false,
		);
	});

	test("defaults interval_seconds to 600 and rejects values outside 60-3600", () => {
		let defaulted = s.parseSafe(CreateMonitorSchema, baseFormData());
		expect(defaulted.success).toBe(true);
		if (defaulted.success) {
			expect(defaulted.value.interval_seconds).toBe(600);
		}

		expect(s.parseSafe(CreateMonitorSchema, baseFormData({ interval_seconds: "59" })).success).toBe(
			false,
		);
		expect(
			s.parseSafe(CreateMonitorSchema, baseFormData({ interval_seconds: "3601" })).success,
		).toBe(false);
	});

	test("defaults location_hint to wnam when omitted", () => {
		let result = s.parseSafe(CreateMonitorSchema, baseFormData());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.location_hint).toBe("wnam");
		}
	});

	test("rejects an unsupported location_hint", () => {
		expect(s.parseSafe(CreateMonitorSchema, baseFormData({ location_hint: "mars" })).success).toBe(
			false,
		);
	});
});

describe("UpdateMonitorSchema", () => {
	test("accepts valid fields plus monitor_id", () => {
		let formData = baseFormData({ monitor_id: "mon_1" });
		expect(s.parseSafe(UpdateMonitorSchema, formData).success).toBe(true);
	});

	test("rejects an update missing monitor_id", () => {
		expect(s.parseSafe(UpdateMonitorSchema, baseFormData()).success).toBe(false);
	});
});
