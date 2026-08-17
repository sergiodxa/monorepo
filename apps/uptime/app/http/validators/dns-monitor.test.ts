/**
 * Unit tests for the DNS monitor form validators: the `interval_seconds` floor and default,
 * the `is_enabled` defaults that differ between create and update, the optional zone-file
 * paste, and the review/toggle/import schemas the record-level actions parse.
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
	CreateDnsMonitorSchema,
	DEFAULT_DNS_INTERVAL_SECONDS,
	DnsMonitorIdSchema,
	ImportDnsMonitorZoneFileSchema,
	MIN_DNS_INTERVAL_SECONDS,
	ReviewDnsMonitorSchema,
	ToggleDnsMonitorRecordSchema,
	UpdateDnsMonitorSchema,
} from "~/app/http/validators/dns-monitor";

function baseFormData(overrides: Record<string, string> = {}): FormData {
	let formData = new FormData();
	formData.set("name", "Primary domain");
	formData.set("domain", "example.com");
	for (let [key, value] of Object.entries(overrides)) formData.set(key, value);
	return formData;
}

describe("CreateDnsMonitorSchema", () => {
	test("accepts valid required fields alone", () => {
		expect(s.parseSafe(CreateDnsMonitorSchema, baseFormData()).success).toBe(true);
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

	test("defaults interval_seconds to once a day when omitted", () => {
		let result = s.parseSafe(CreateDnsMonitorSchema, baseFormData());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.interval_seconds).toBe(DEFAULT_DNS_INTERVAL_SECONDS);
		}
	});

	/**
	 * The floor moved from 300 to 900, and the API's from 60, so both channels enforce the
	 * one limit a six-type sweep can afford. A value the old form accepted must now fail.
	 */
	test("rejects an interval_seconds below the 900-second minimum", () => {
		let formData = baseFormData({ interval_seconds: String(MIN_DNS_INTERVAL_SECONDS - 1) });
		expect(s.parseSafe(CreateDnsMonitorSchema, formData).success).toBe(false);
	});

	test("rejects 300, which the old floor allowed", () => {
		expect(
			s.parseSafe(CreateDnsMonitorSchema, baseFormData({ interval_seconds: "300" })).success,
		).toBe(false);
	});

	test("accepts exactly the 900-second minimum", () => {
		let formData = baseFormData({ interval_seconds: "900" });
		expect(s.parseSafe(CreateDnsMonitorSchema, formData).success).toBe(true);
	});

	test("rejects an interval_seconds above the 86400-second maximum", () => {
		let formData = baseFormData({ interval_seconds: "86401" });
		expect(s.parseSafe(CreateDnsMonitorSchema, formData).success).toBe(false);
	});

	/** The review step follows a create, so a monitor nobody enabled would never run. */
	test("defaults is_enabled to true when omitted", () => {
		let result = s.parseSafe(CreateDnsMonitorSchema, baseFormData());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.is_enabled).toBe(true);
		}
	});

	test("coerces is_enabled from a 'false' string", () => {
		let formData = baseFormData({ is_enabled: "false" });
		let result = s.parseSafe(CreateDnsMonitorSchema, formData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.is_enabled).toBe(false);
		}
	});

	test("accepts a pasted zone file, and leaves it undefined when there is none", () => {
		let without = s.parseSafe(CreateDnsMonitorSchema, baseFormData());
		expect(without.success).toBe(true);
		if (without.success) expect(without.value.zone_file).toBeUndefined();

		let withPaste = s.parseSafe(
			CreateDnsMonitorSchema,
			baseFormData({ zone_file: "example.com. 1 IN A 1.2.3.4" }),
		);
		expect(withPaste.success).toBe(true);
		if (withPaste.success) {
			expect(withPaste.value.zone_file).toBe("example.com. 1 IN A 1.2.3.4");
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

	/**
	 * The opposite default from create, and deliberately so: an unchecked checkbox is absent
	 * from the body, so defaulting to `true` here would make disabling a monitor impossible.
	 */
	test("defaults is_enabled to false so unchecking the edit form's toggle disables the monitor", () => {
		let result = s.parseSafe(UpdateDnsMonitorSchema, baseFormData({ monitor_id: "mon_1" }));
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.is_enabled).toBe(false);
		}
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

describe("ReviewDnsMonitorSchema", () => {
	test("reads every checked record id", () => {
		let formData = new FormData();
		formData.set("monitor_id", "mon_1");
		formData.append("record_ids", "rec_1");
		formData.append("record_ids", "rec_2");

		let result = s.parseSafe(ReviewDnsMonitorSchema, formData);
		expect(result.success).toBe(true);
		if (result.success) expect(result.value.record_ids).toEqual(["rec_1", "rec_2"]);
	});

	/** Unchecking everything is a decision — "watch none of this" — not a malformed body. */
	test("accepts a submission with no checked records at all", () => {
		let formData = new FormData();
		formData.set("monitor_id", "mon_1");

		let result = s.parseSafe(ReviewDnsMonitorSchema, formData);
		expect(result.success).toBe(true);
		if (result.success) expect(result.value.record_ids).toEqual([]);
	});

	test("rejects a submission missing monitor_id", () => {
		expect(s.parseSafe(ReviewDnsMonitorSchema, new FormData()).success).toBe(false);
	});
});

describe("ToggleDnsMonitorRecordSchema", () => {
	test("accepts a monitor, a record and a coerced flag", () => {
		let formData = new FormData();
		formData.set("monitor_id", "mon_1");
		formData.set("record_id", "rec_1");
		formData.set("is_enabled", "true");

		let result = s.parseSafe(ToggleDnsMonitorRecordSchema, formData);
		expect(result.success).toBe(true);
		if (result.success) expect(result.value.is_enabled).toBe(true);
	});

	test("defaults is_enabled to false when the checkbox is absent", () => {
		let formData = new FormData();
		formData.set("monitor_id", "mon_1");
		formData.set("record_id", "rec_1");

		let result = s.parseSafe(ToggleDnsMonitorRecordSchema, formData);
		expect(result.success).toBe(true);
		if (result.success) expect(result.value.is_enabled).toBe(false);
	});

	test("rejects a toggle with no record_id", () => {
		let formData = new FormData();
		formData.set("monitor_id", "mon_1");
		expect(s.parseSafe(ToggleDnsMonitorRecordSchema, formData).success).toBe(false);
	});
});

describe("ImportDnsMonitorZoneFileSchema", () => {
	test("accepts a monitor id and a non-empty paste", () => {
		let formData = new FormData();
		formData.set("monitor_id", "mon_1");
		formData.set("zone_file", "example.com. 1 IN A 1.2.3.4");
		expect(s.parseSafe(ImportDnsMonitorZoneFileSchema, formData).success).toBe(true);
	});

	/** An empty paste would report an import that discovered nothing new. */
	test("rejects an empty paste", () => {
		let formData = new FormData();
		formData.set("monitor_id", "mon_1");
		formData.set("zone_file", "");
		expect(s.parseSafe(ImportDnsMonitorZoneFileSchema, formData).success).toBe(false);
	});
});
