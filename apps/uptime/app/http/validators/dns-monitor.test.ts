/**
 * Unit tests for the DNS monitor create/update/delete/check form validators: the
 * `record_type` enum, the `interval_seconds` bounds and default, and the shared
 * `delete`/`check` id schema.
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

import { describe, expect, test } from "bun:test";

import * as s from "remix/data-schema";

import {
	CreateDnsMonitorSchema,
	DnsMonitorIdSchema,
	UpdateDnsMonitorSchema,
} from "~/app/http/validators/dns-monitor";

function baseFormData(overrides: Record<string, string> = {}): FormData {
	let formData = new FormData();
	formData.set("name", "Primary domain");
	formData.set("domain", "example.com");
	formData.set("record_type", "A");
	for (let [key, value] of Object.entries(overrides)) formData.set(key, value);
	return formData;
}

describe("CreateDnsMonitorSchema", () => {
	test("accepts valid required fields alone", () => {
		expect(s.parseSafe(CreateDnsMonitorSchema, baseFormData()).success).toBe(true);
	});

	test.each(["A", "AAAA", "CNAME", "MX", "TXT", "NS"])("accepts record_type '%s'", (recordType) => {
		let formData = baseFormData({ record_type: recordType });
		expect(s.parseSafe(CreateDnsMonitorSchema, formData).success).toBe(true);
	});

	test("rejects an unknown record_type", () => {
		let formData = baseFormData({ record_type: "SRV" });
		expect(s.parseSafe(CreateDnsMonitorSchema, formData).success).toBe(false);
	});

	test("rejects an empty name", () => {
		expect(s.parseSafe(CreateDnsMonitorSchema, baseFormData({ name: "" })).success).toBe(false);
	});

	test("rejects a name longer than 255 characters", () => {
		let formData = baseFormData({ name: "a".repeat(256) });
		expect(s.parseSafe(CreateDnsMonitorSchema, formData).success).toBe(false);
	});

	test("rejects an empty domain", () => {
		expect(s.parseSafe(CreateDnsMonitorSchema, baseFormData({ domain: "" })).success).toBe(false);
	});

	test("leaves expected_value undefined when omitted, since it is optional", () => {
		let result = s.parseSafe(CreateDnsMonitorSchema, baseFormData());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.expected_value).toBeUndefined();
		}
	});

	test("defaults interval_seconds to 3600 when omitted", () => {
		let result = s.parseSafe(CreateDnsMonitorSchema, baseFormData());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.interval_seconds).toBe(3600);
		}
	});

	test("rejects an interval_seconds below the 300-second minimum", () => {
		let formData = baseFormData({ interval_seconds: "299" });
		expect(s.parseSafe(CreateDnsMonitorSchema, formData).success).toBe(false);
	});

	test("rejects an interval_seconds above the 86400-second maximum", () => {
		let formData = baseFormData({ interval_seconds: "86401" });
		expect(s.parseSafe(CreateDnsMonitorSchema, formData).success).toBe(false);
	});

	test("defaults is_enabled to false when omitted", () => {
		let result = s.parseSafe(CreateDnsMonitorSchema, baseFormData());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.is_enabled).toBe(false);
		}
	});

	test("coerces is_enabled from a 'true' string", () => {
		let formData = baseFormData({ is_enabled: "true" });
		let result = s.parseSafe(CreateDnsMonitorSchema, formData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.is_enabled).toBe(true);
		}
	});
});

describe("UpdateDnsMonitorSchema", () => {
	test("accepts valid fields plus monitor_id", () => {
		let formData = baseFormData({ monitor_id: "mon_1" });
		expect(s.parseSafe(UpdateDnsMonitorSchema, formData).success).toBe(true);
	});

	test("rejects an update missing monitor_id", () => {
		expect(s.parseSafe(UpdateDnsMonitorSchema, baseFormData()).success).toBe(false);
	});
});

describe("DnsMonitorIdSchema", () => {
	test("accepts a valid monitor_id", () => {
		let formData = new FormData();
		formData.set("monitor_id", "mon_1");
		expect(s.parseSafe(DnsMonitorIdSchema, formData).success).toBe(true);
	});

	test("rejects a missing monitor_id", () => {
		expect(s.parseSafe(DnsMonitorIdSchema, new FormData()).success).toBe(false);
	});
});
