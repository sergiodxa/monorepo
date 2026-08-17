/**
 * Unit tests for the cron-job monitor create/update/delete form validators: required
 * fields, the `timezone`/`grace_period_seconds` defaults, and the `update-cron-job`
 * schema's extra `monitor_id` field.
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

import {
	CreateCronJobSchema,
	CronJobIdSchema,
	UpdateCronJobSchema,
} from "~/app/http/validators/cron-job";

function baseFormData(overrides: Record<string, string> = {}): FormData {
	let formData = new FormData();
	formData.set("name", "Nightly backup");
	formData.set("cron_expression", "0 2 * * *");
	for (let [key, value] of Object.entries(overrides)) formData.set(key, value);
	return formData;
}

describe("CreateCronJobSchema", () => {
	test("accepts valid required fields alone", () => {
		expect(s.parseSafe(CreateCronJobSchema, baseFormData()).success).toBe(true);
	});

	test("rejects an empty name", () => {
		expect(s.parseSafe(CreateCronJobSchema, baseFormData({ name: "" })).success).toBe(false);
	});

	test("rejects a name longer than 255 characters", () => {
		let formData = baseFormData({ name: "a".repeat(256) });
		expect(s.parseSafe(CreateCronJobSchema, formData).success).toBe(false);
	});

	test("rejects an empty cron_expression", () => {
		let formData = baseFormData({ cron_expression: "" });
		expect(s.parseSafe(CreateCronJobSchema, formData).success).toBe(false);
	});

	test("leaves description undefined when omitted, since it is optional", () => {
		let result = s.parseSafe(CreateCronJobSchema, baseFormData());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.description).toBeUndefined();
		}
	});

	test("defaults timezone to UTC when omitted", () => {
		let result = s.parseSafe(CreateCronJobSchema, baseFormData());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.timezone).toBe("UTC");
		}
	});

	test("accepts an explicit timezone", () => {
		let result = s.parseSafe(CreateCronJobSchema, baseFormData({ timezone: "America/New_York" }));
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.timezone).toBe("America/New_York");
		}
	});

	test("keeps accepting UTC, the default every stored job holds", () => {
		// `Intl.supportedValuesOf("timeZone")` doesn't return "UTC", so this only passes
		// because the accepted set names it explicitly — see `app/lib/timezones.ts`.
		let result = s.parseSafe(CreateCronJobSchema, baseFormData({ timezone: "UTC" }));
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.timezone).toBe("UTC");
		}
	});

	test("rejects a timezone the IANA database doesn't know", () => {
		let result = s.parseSafe(CreateCronJobSchema, baseFormData({ timezone: "Mars/Olympus_Mons" }));
		expect(result.success).toBe(false);
		if (!result.success) {
			// The rejection is a field-level issue naming `timezone`, not a thrown error.
			expect(result.issues).toEqual([
				{ message: "Expected a valid IANA time zone", path: ["timezone"] },
			]);
		}
	});

	test("rejects a second spelling of UTC, so one zone has one stored value", () => {
		// No runtime this app runs on enumerates `Etc/UTC`, and the accepted set adds only
		// "UTC", so the alias never becomes a second way to store the same zone.
		expect(s.parseSafe(CreateCronJobSchema, baseFormData({ timezone: "Etc/UTC" })).success).toBe(
			false,
		);
	});

	test("defaults grace_period_seconds to 300 when omitted", () => {
		let result = s.parseSafe(CreateCronJobSchema, baseFormData());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.grace_period_seconds).toBe(300);
		}
	});

	test("rejects a grace_period_seconds below the 60-second minimum", () => {
		let formData = baseFormData({ grace_period_seconds: "59" });
		expect(s.parseSafe(CreateCronJobSchema, formData).success).toBe(false);
	});

	test("rejects a grace_period_seconds above the 86400-second maximum", () => {
		let formData = baseFormData({ grace_period_seconds: "86401" });
		expect(s.parseSafe(CreateCronJobSchema, formData).success).toBe(false);
	});

	test("defaults alert_on_late and is_enabled to false when omitted", () => {
		let result = s.parseSafe(CreateCronJobSchema, baseFormData());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.alert_on_late).toBe(false);
			expect(result.value.is_enabled).toBe(false);
		}
	});

	test("coerces alert_on_late and is_enabled from 'true' strings", () => {
		let formData = baseFormData({ alert_on_late: "true", is_enabled: "true" });
		let result = s.parseSafe(CreateCronJobSchema, formData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.alert_on_late).toBe(true);
			expect(result.value.is_enabled).toBe(true);
		}
	});

	test("rejects a non-boolean-like is_enabled value", () => {
		let formData = baseFormData({ is_enabled: "yes" });
		expect(s.parseSafe(CreateCronJobSchema, formData).success).toBe(false);
	});
});

describe("UpdateCronJobSchema", () => {
	test("accepts valid fields plus monitor_id", () => {
		let formData = baseFormData({ monitor_id: "mon_1" });
		expect(s.parseSafe(UpdateCronJobSchema, formData).success).toBe(true);
	});

	test("rejects an update missing monitor_id", () => {
		expect(s.parseSafe(UpdateCronJobSchema, baseFormData()).success).toBe(false);
	});
});

describe("CronJobIdSchema", () => {
	test("accepts a valid monitor_id", () => {
		let formData = new FormData();
		formData.set("monitor_id", "mon_1");
		expect(s.parseSafe(CronJobIdSchema, formData).success).toBe(true);
	});

	test("rejects a missing monitor_id", () => {
		expect(s.parseSafe(CronJobIdSchema, new FormData()).success).toBe(false);
	});
});
