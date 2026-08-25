/**
 * Unit tests for the maintenance-window create/update/delete/end-early form
 * validators: the `datetime-local` parsing into epoch milliseconds and the
 * `.refine()` that requires `ends_at` to be after `starts_at`.
 *
 * Exercises the schemas directly via `remix/data-schema`'s `parseSafe()` with real
 * `FormData`, since these `f.object(...)` form-data schemas require a raw `FormData`
 * or `URLSearchParams` instance for their field-level rules to run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import {
	CreateMaintenanceWindowSchema,
	MaintenanceWindowIdSchema,
	UpdateMaintenanceWindowSchema,
} from "~/app/http/validators/maintenance-window";

function baseFormData(overrides: Record<string, string> = {}): FormData {
	let formData = new FormData();
	formData.set("name", "Database upgrade");
	formData.set("starts_at", "2026-01-05T02:00");
	formData.set("ends_at", "2026-01-05T04:00");
	for (let [key, value] of Object.entries(overrides)) formData.set(key, value);
	return formData;
}

describe("CreateMaintenanceWindowSchema", () => {
	test("accepts valid required fields alone", () => {
		let result = s.parseSafe(CreateMaintenanceWindowSchema, baseFormData());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(typeof result.value.starts_at).toBe("number");
			expect(typeof result.value.ends_at).toBe("number");
			expect(result.value.ends_at).toBeGreaterThan(result.value.starts_at);
		}
	});

	test("rejects an empty name", () => {
		expect(s.parseSafe(CreateMaintenanceWindowSchema, baseFormData({ name: "" })).success).toBe(
			false,
		);
	});

	test("rejects an ends_at that is before starts_at", () => {
		let formData = baseFormData({ starts_at: "2026-01-05T04:00", ends_at: "2026-01-05T02:00" });
		let result = s.parseSafe(CreateMaintenanceWindowSchema, formData);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.issues[0]?.message).toBe("End time must be after start time.");
		}
	});

	test("rejects an ends_at equal to starts_at", () => {
		let formData = baseFormData({ starts_at: "2026-01-05T02:00", ends_at: "2026-01-05T02:00" });
		expect(s.parseSafe(CreateMaintenanceWindowSchema, formData).success).toBe(false);
	});

	test("rejects an unparseable starts_at value", () => {
		let formData = baseFormData({ starts_at: "not-a-date" });
		let result = s.parseSafe(CreateMaintenanceWindowSchema, formData);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.issues[0]?.message).toBe("Invalid date/time.");
		}
	});

	test("rejects a missing starts_at field", () => {
		let formData = baseFormData();
		formData.delete("starts_at");
		expect(s.parseSafe(CreateMaintenanceWindowSchema, formData).success).toBe(false);
	});

	test("leaves recurring_pattern undefined when omitted", () => {
		let result = s.parseSafe(CreateMaintenanceWindowSchema, baseFormData());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.recurring_pattern).toBeUndefined();
		}
	});

	/** An omitted scope is the team-wide one, which is what a window nobody narrows covers. */
	test("defaults scope to the empty string when omitted", () => {
		let result = s.parseSafe(CreateMaintenanceWindowSchema, baseFormData());
		expect(result.success).toBe(true);
		if (result.success) expect(result.value.scope).toBe("");
	});

	test("carries a type-scoped and a monitor-scoped value through untouched", () => {
		for (let scope of ["type:dns", "monitor:dns:abc"]) {
			let result = s.parseSafe(CreateMaintenanceWindowSchema, baseFormData({ scope }));
			expect(result.success).toBe(true);
			if (result.success) expect(result.value.scope).toBe(scope);
		}
	});

	test("defaults suppress_alerts, show_on_status_page and is_recurring to false", () => {
		let result = s.parseSafe(CreateMaintenanceWindowSchema, baseFormData());
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.suppress_alerts).toBe(false);
			expect(result.value.show_on_status_page).toBe(false);
			expect(result.value.is_recurring).toBe(false);
		}
	});

	test("coerces suppress_alerts from a 'true' string", () => {
		let formData = baseFormData({ suppress_alerts: "true" });
		let result = s.parseSafe(CreateMaintenanceWindowSchema, formData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.suppress_alerts).toBe(true);
		}
	});

	test("accepts an explicit recurring_pattern when is_recurring is set", () => {
		let formData = baseFormData({ is_recurring: "true", recurring_pattern: "daily:02:00-04:00" });
		let result = s.parseSafe(CreateMaintenanceWindowSchema, formData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.recurring_pattern).toBe("daily:02:00-04:00");
		}
	});
});

describe("UpdateMaintenanceWindowSchema", () => {
	test("accepts valid fields plus window_id", () => {
		let formData = baseFormData({ window_id: "win_1" });
		expect(s.parseSafe(UpdateMaintenanceWindowSchema, formData).success).toBe(true);
	});

	test("rejects an update missing window_id", () => {
		expect(s.parseSafe(UpdateMaintenanceWindowSchema, baseFormData()).success).toBe(false);
	});

	test("applies the same ends_at-after-starts_at refinement as create", () => {
		let formData = baseFormData({
			window_id: "win_1",
			starts_at: "2026-01-05T04:00",
			ends_at: "2026-01-05T02:00",
		});
		expect(s.parseSafe(UpdateMaintenanceWindowSchema, formData).success).toBe(false);
	});
});

describe("MaintenanceWindowIdSchema", () => {
	test("accepts a valid window_id", () => {
		let formData = new FormData();
		formData.set("window_id", "win_1");
		expect(s.parseSafe(MaintenanceWindowIdSchema, formData).success).toBe(true);
	});

	test("rejects a missing window_id", () => {
		expect(s.parseSafe(MaintenanceWindowIdSchema, new FormData()).success).toBe(false);
	});
});
