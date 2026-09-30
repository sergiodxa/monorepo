/**
 * Form validation schemas for maintenance-window create/update/delete/end-early
 * actions. `datetime-local` values are read as wall clocks in the team's zone, and
 * `.refine()` enforces `ends_at` is after `starts_at`, matching `docs/maintenance-windows.md`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TimeZone } from "@sdxc/dates";

import { parseDateTimeLocal } from "@sdxc/dates";
import { isSuccess } from "@sdxc/result";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";
import * as f from "remix/data-schema/form-data";

interface WindowFieldValues {
	starts_at: number;
	ends_at: number;
}

/**
 * The zone a team's maintenance-window form reads and shows its wall clocks in.
 * Teams carry no zone of their own, so every team schedules in UTC, the same zone
 * the list, the status page and the calendar feed render windows in.
 */
export const MAINTENANCE_TIME_ZONE: TimeZone = "UTC";

/**
 * Parses a `datetime-local` input value into epoch milliseconds, reading it as a wall
 * clock in `timeZone`; a malformed value or a day the month lacks becomes `NaN` and
 * fails the "Invalid date/time." refinement.
 */
function datetimeLocal(timeZone: TimeZone) {
	return s
		.string()
		.transform((value) => {
			let parsed = parseDateTimeLocal(value, timeZone);
			return isSuccess(parsed) ? parsed.data.getTime() : Number.NaN;
		})
		.refine((value) => Number.isFinite(value), "Invalid date/time.");
}

/** Field shape shared by the create and update maintenance-window forms, clocks read in `timeZone`. */
function maintenanceWindowFields(timeZone: TimeZone) {
	return {
		name: f.field(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
		/**
		 * The `(monitor_type, monitor_id)` pair encoded as one control value; see
		 * `~/app/lib/monitor-scope`. Validated for shape here — resolving whether
		 * the named monitor exists and belongs to the team happens in the action.
		 */
		scope: f.field(s.defaulted(s.string(), "")),
		starts_at: f.field(datetimeLocal(timeZone)),
		ends_at: f.field(datetimeLocal(timeZone)),
		suppress_alerts: f.field(s.defaulted(coerce.boolean(), false)),
		show_on_status_page: f.field(s.defaulted(coerce.boolean(), false)),
		is_recurring: f.field(s.defaulted(coerce.boolean(), false)),
		recurring_pattern: f.field(s.optional(s.string())),
	};
}

/**
 * Validates the `create-maintenance-window` action form body, reading its start and end
 * clocks in `timeZone`.
 */
export function createMaintenanceWindowSchema(timeZone: TimeZone) {
	return f
		.object(maintenanceWindowFields(timeZone))
		.refine(
			(value: WindowFieldValues) => value.ends_at > value.starts_at,
			"End time must be after start time.",
		);
}

/** Validates the `create-maintenance-window` form in {@link MAINTENANCE_TIME_ZONE}. */
export const CreateMaintenanceWindowSchema = createMaintenanceWindowSchema(MAINTENANCE_TIME_ZONE);

export type CreateMaintenanceWindowValues = s.InferOutput<typeof CreateMaintenanceWindowSchema>;

/**
 * Validates the `update-maintenance-window` action form body, reading its start and end
 * clocks in `timeZone`.
 */
export function updateMaintenanceWindowSchema(timeZone: TimeZone) {
	return f
		.object({ window_id: f.field(s.string()), ...maintenanceWindowFields(timeZone) })
		.refine(
			(value: WindowFieldValues) => value.ends_at > value.starts_at,
			"End time must be after start time.",
		);
}

/** Validates the `update-maintenance-window` form in {@link MAINTENANCE_TIME_ZONE}. */
export const UpdateMaintenanceWindowSchema = updateMaintenanceWindowSchema(MAINTENANCE_TIME_ZONE);

export type UpdateMaintenanceWindowValues = s.InferOutput<typeof UpdateMaintenanceWindowSchema>;

/** Validates the `delete-maintenance-window` and `end-maintenance-window` action form bodies. */
export const MaintenanceWindowIdSchema = f.object({ window_id: f.field(s.string()) });
