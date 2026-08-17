/**
 * Unit tests for the status-page create/update/delete form validators: the `slug`
 * URL-safe pattern, the `is_public`/`show_overall_status` defaults, and the four
 * checkbox-group id-list fields read via `f.fields()`.
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
	CreateStatusPageSchema,
	StatusPageIdSchema,
	UpdateStatusPageSchema,
} from "~/app/http/validators/status-page";

function baseFormData(overrides: Record<string, string> = {}): FormData {
	let formData = new FormData();
	formData.set("name", "Public status");
	formData.set("slug", "public-status");
	formData.set("title", "Service Status");
	for (let [key, value] of Object.entries(overrides)) formData.set(key, value);
	return formData;
}

describe("CreateStatusPageSchema", () => {
	test("accepts valid required fields alone", () => {
		expect(s.parseSafe(CreateStatusPageSchema, baseFormData()).success).toBe(true);
	});

	test("rejects an empty name", () => {
		expect(s.parseSafe(CreateStatusPageSchema, baseFormData({ name: "" })).success).toBe(false);
	});

	test("rejects an empty title", () => {
		expect(s.parseSafe(CreateStatusPageSchema, baseFormData({ title: "" })).success).toBe(false);
	});

	test("rejects a slug with uppercase letters or spaces", () => {
		let result = s.parseSafe(CreateStatusPageSchema, baseFormData({ slug: "Not Valid!" }));
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.issues[0]?.message).toBe("Use lowercase letters, numbers, and hyphens only.");
		}
	});

	test("accepts a slug with lowercase letters, numbers, and hyphens", () => {
		expect(s.parseSafe(CreateStatusPageSchema, baseFormData({ slug: "status-42" })).success).toBe(
			true,
		);
	});

	test("rejects an empty slug", () => {
		expect(s.parseSafe(CreateStatusPageSchema, baseFormData({ slug: "" })).success).toBe(false);
	});

	test("rejects a slug longer than 63 characters", () => {
		let formData = baseFormData({ slug: "a".repeat(64) });
		expect(s.parseSafe(CreateStatusPageSchema, formData).success).toBe(false);
	});

	test("leaves description and logo_url undefined when omitted, since they are optional", () => {
		let result = s.parseSafe(CreateStatusPageSchema, baseFormData());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.description).toBeUndefined();
			expect(result.value.logo_url).toBeUndefined();
		}
	});

	test("defaults is_public and show_overall_status to true when omitted", () => {
		let result = s.parseSafe(CreateStatusPageSchema, baseFormData());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.is_public).toBe(true);
			expect(result.value.show_overall_status).toBe(true);
		}
	});

	test("coerces is_public to false from a 'false' string", () => {
		let formData = baseFormData({ is_public: "false" });
		let result = s.parseSafe(CreateStatusPageSchema, formData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.is_public).toBe(false);
		}
	});

	test("defaults every id-list field to an empty array when no checkboxes are checked", () => {
		let result = s.parseSafe(CreateStatusPageSchema, baseFormData());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.monitor_ids).toEqual([]);
			expect(result.value.dns_monitor_ids).toEqual([]);
			expect(result.value.tcp_monitor_ids).toEqual([]);
			expect(result.value.cron_job_ids).toEqual([]);
		}
	});

	test("reads every checked id from each checkbox group", () => {
		let formData = baseFormData();
		formData.append("monitor_ids", "mon_1");
		formData.append("monitor_ids", "mon_2");
		formData.append("dns_monitor_ids", "dns_1");
		formData.append("tcp_monitor_ids", "tcp_1");
		formData.append("cron_job_ids", "cron_1");
		let result = s.parseSafe(CreateStatusPageSchema, formData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.monitor_ids).toEqual(["mon_1", "mon_2"]);
			expect(result.value.dns_monitor_ids).toEqual(["dns_1"]);
			expect(result.value.tcp_monitor_ids).toEqual(["tcp_1"]);
			expect(result.value.cron_job_ids).toEqual(["cron_1"]);
		}
	});
});

describe("UpdateStatusPageSchema", () => {
	test("accepts valid fields plus status_page_id", () => {
		let formData = baseFormData({ status_page_id: "sp_1" });
		expect(s.parseSafe(UpdateStatusPageSchema, formData).success).toBe(true);
	});

	test("rejects an update missing status_page_id", () => {
		expect(s.parseSafe(UpdateStatusPageSchema, baseFormData()).success).toBe(false);
	});
});

describe("StatusPageIdSchema", () => {
	test("accepts a valid status_page_id", () => {
		let formData = new FormData();
		formData.set("status_page_id", "sp_1");
		expect(s.parseSafe(StatusPageIdSchema, formData).success).toBe(true);
	});

	test("rejects a missing status_page_id", () => {
		expect(s.parseSafe(StatusPageIdSchema, new FormData()).success).toBe(false);
	});
});
