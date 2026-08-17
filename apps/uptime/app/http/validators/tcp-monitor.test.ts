/**
 * Unit tests for the TCP monitor create/update/delete/check form validators: the
 * required, un-defaulted `port` field and the timing fields' bounds/defaults.
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
	CreateTcpMonitorSchema,
	TcpMonitorIdSchema,
	UpdateTcpMonitorSchema,
} from "~/app/http/validators/tcp-monitor";

function baseFormData(overrides: Record<string, string> = {}): FormData {
	let formData = new FormData();
	formData.set("name", "Redis");
	formData.set("host", "redis.internal");
	formData.set("port", "6379");
	for (let [key, value] of Object.entries(overrides)) formData.set(key, value);
	return formData;
}

describe("CreateTcpMonitorSchema", () => {
	test("accepts valid required fields alone", () => {
		expect(s.parseSafe(CreateTcpMonitorSchema, baseFormData()).success).toBe(true);
	});

	test("rejects an empty name", () => {
		expect(s.parseSafe(CreateTcpMonitorSchema, baseFormData({ name: "" })).success).toBe(false);
	});

	test("rejects an empty host", () => {
		expect(s.parseSafe(CreateTcpMonitorSchema, baseFormData({ host: "" })).success).toBe(false);
	});

	test("rejects a missing port, since it has no default", () => {
		let formData = baseFormData();
		formData.delete("port");
		let result = s.parseSafe(CreateTcpMonitorSchema, formData);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.issues[0]?.message).toBe("Expected number");
		}
	});

	test("rejects a non-numeric port", () => {
		expect(s.parseSafe(CreateTcpMonitorSchema, baseFormData({ port: "not-a-port" })).success).toBe(
			false,
		);
	});

	test("rejects a port outside 1-65535", () => {
		expect(s.parseSafe(CreateTcpMonitorSchema, baseFormData({ port: "0" })).success).toBe(false);
		expect(s.parseSafe(CreateTcpMonitorSchema, baseFormData({ port: "65536" })).success).toBe(
			false,
		);
	});

	test("defaults timeout_ms to 5000 and rejects values outside 100-60000", () => {
		let defaulted = s.parseSafe(CreateTcpMonitorSchema, baseFormData());
		expect(defaulted.success).toBe(true);
		if (defaulted.success) {
			expect(defaulted.value.timeout_ms).toBe(5000);
		}

		expect(s.parseSafe(CreateTcpMonitorSchema, baseFormData({ timeout_ms: "99" })).success).toBe(
			false,
		);
		expect(s.parseSafe(CreateTcpMonitorSchema, baseFormData({ timeout_ms: "60001" })).success).toBe(
			false,
		);
	});

	test("defaults interval_seconds to 300 and rejects values outside 10-86400", () => {
		let defaulted = s.parseSafe(CreateTcpMonitorSchema, baseFormData());
		expect(defaulted.success).toBe(true);
		if (defaulted.success) {
			expect(defaulted.value.interval_seconds).toBe(300);
		}

		expect(
			s.parseSafe(CreateTcpMonitorSchema, baseFormData({ interval_seconds: "9" })).success,
		).toBe(false);
		expect(
			s.parseSafe(CreateTcpMonitorSchema, baseFormData({ interval_seconds: "86401" })).success,
		).toBe(false);
	});

	test("defaults is_enabled to true when omitted, since the create form has no toggle", () => {
		let result = s.parseSafe(CreateTcpMonitorSchema, baseFormData());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.is_enabled).toBe(true);
		}
	});
});

describe("UpdateTcpMonitorSchema", () => {
	test("accepts valid fields plus monitor_id", () => {
		let formData = baseFormData({ monitor_id: "mon_1" });
		expect(s.parseSafe(UpdateTcpMonitorSchema, formData).success).toBe(true);
	});

	test("rejects an update missing monitor_id", () => {
		expect(s.parseSafe(UpdateTcpMonitorSchema, baseFormData()).success).toBe(false);
	});

	test("defaults is_enabled to false when omitted, so unchecking the edit form's toggle disables the monitor", () => {
		let result = s.parseSafe(UpdateTcpMonitorSchema, baseFormData({ monitor_id: "mon_1" }));
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.is_enabled).toBe(false);
		}
	});
});

describe("TcpMonitorIdSchema", () => {
	test("accepts a valid monitor_id", () => {
		let formData = new FormData();
		formData.set("monitor_id", "mon_1");
		expect(s.parseSafe(TcpMonitorIdSchema, formData).success).toBe(true);
	});

	test("rejects a missing monitor_id", () => {
		expect(s.parseSafe(TcpMonitorIdSchema, new FormData()).success).toBe(false);
	});
});
