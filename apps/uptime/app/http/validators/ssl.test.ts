/**
 * Unit tests for the `update-ssl` form validator: the manually entered expiry data
 * (`ssl_expiry_warning_days` bounds/default, optional `ssl_expires_at`/`ssl_issuer`
 * text fields).
 *
 * Exercises the schema directly via `remix/data-schema`'s `parseSafe()` with real
 * `FormData`, not `@pkg/validate`'s `validate()`: `validate()` normalizes `FormData`
 * into a plain object before handing it to the schema, but this is an `f.object(...)`
 * form-data schema that only accepts the raw `FormData`/`URLSearchParams` instance, so
 * every call through `validate()` fails before the field-level rules ever run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import { UpdateSslSchema } from "~/app/http/validators/ssl";

function baseFormData(overrides: Record<string, string> = {}): FormData {
	let formData = new FormData();
	formData.set("monitor_id", "mon_1");
	for (let [key, value] of Object.entries(overrides)) formData.set(key, value);
	return formData;
}

describe("UpdateSslSchema", () => {
	test("accepts a valid monitor_id alone", () => {
		expect(s.parseSafe(UpdateSslSchema, baseFormData()).success).toBe(true);
	});

	test("rejects a missing monitor_id", () => {
		let formData = baseFormData();
		formData.delete("monitor_id");
		expect(s.parseSafe(UpdateSslSchema, formData).success).toBe(false);
	});

	test("defaults ssl_monitoring_enabled to false when omitted", () => {
		let result = s.parseSafe(UpdateSslSchema, baseFormData());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.ssl_monitoring_enabled).toBe(false);
		}
	});

	test("coerces ssl_monitoring_enabled from a 'true' string", () => {
		let formData = baseFormData({ ssl_monitoring_enabled: "true" });
		let result = s.parseSafe(UpdateSslSchema, formData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.ssl_monitoring_enabled).toBe(true);
		}
	});

	test("rejects a non-boolean-like ssl_monitoring_enabled value", () => {
		let formData = baseFormData({ ssl_monitoring_enabled: "on" });
		expect(s.parseSafe(UpdateSslSchema, formData).success).toBe(false);
	});

	test("defaults ssl_expiry_warning_days to 30 when omitted", () => {
		let result = s.parseSafe(UpdateSslSchema, baseFormData());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.ssl_expiry_warning_days).toBe(30);
		}
	});

	test("rejects an ssl_expiry_warning_days outside 1-365", () => {
		expect(
			s.parseSafe(UpdateSslSchema, baseFormData({ ssl_expiry_warning_days: "0" })).success,
		).toBe(false);
		expect(
			s.parseSafe(UpdateSslSchema, baseFormData({ ssl_expiry_warning_days: "366" })).success,
		).toBe(false);
	});

	test("leaves ssl_expires_at and ssl_issuer undefined when omitted, since they are optional", () => {
		let result = s.parseSafe(UpdateSslSchema, baseFormData());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.ssl_expires_at).toBeUndefined();
			expect(result.value.ssl_issuer).toBeUndefined();
		}
	});

	test("accepts explicit ssl_expires_at and ssl_issuer values", () => {
		let formData = baseFormData({
			ssl_expires_at: "2026-12-31",
			ssl_issuer: "Let's Encrypt",
		});
		let result = s.parseSafe(UpdateSslSchema, formData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.ssl_expires_at).toBe("2026-12-31");
			expect(result.value.ssl_issuer).toBe("Let's Encrypt");
		}
	});
});
