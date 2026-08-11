/**
 * Form validation schemas for maintenance-window create/update/delete/end-early
 * actions. `.refine()` enforces `ends_at` is after `starts_at`, matching
 * `docs/maintenance-windows.md`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";
import * as f from "remix/data-schema/form-data";

interface WindowFieldValues {
	starts_at: number;
	ends_at: number;
}

/** Parses a `datetime-local` input value into epoch milliseconds. */
const datetimeLocal = s
	.string()
	.transform((value) => new Date(value).getTime())
	.refine((value) => Number.isFinite(value), "Invalid date/time.");

/** Field shape shared by the create and update maintenance-window forms. */
const maintenanceWindowFields = {
	name: f.field(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	/**
	 * The `(monitor_type, monitor_id)` pair encoded as one control value — see
	 * `~/app/lib/monitor-scope`. Validated for shape here and resolved against the team's
	 * monitors in the action, which is the only place that can tell whether the monitor
	 * named still exists and still belongs to the team.
	 */
	scope: f.field(s.defaulted(s.string(), "")),
	starts_at: f.field(datetimeLocal),
	ends_at: f.field(datetimeLocal),
	suppress_alerts: f.field(s.defaulted(coerce.boolean(), false)),
	show_on_status_page: f.field(s.defaulted(coerce.boolean(), false)),
	is_recurring: f.field(s.defaulted(coerce.boolean(), false)),
	recurring_pattern: f.field(s.optional(s.string())),
};

/** Validates the `create-maintenance-window` action form body. */
export const CreateMaintenanceWindowSchema = f
	.object(maintenanceWindowFields)
	.refine(
		(value: WindowFieldValues) => value.ends_at > value.starts_at,
		"End time must be after start time.",
	);

export type CreateMaintenanceWindowValues = s.InferOutput<typeof CreateMaintenanceWindowSchema>;

/** Validates the `update-maintenance-window` action form body. */
export const UpdateMaintenanceWindowSchema = f
	.object({ window_id: f.field(s.string()), ...maintenanceWindowFields })
	.refine(
		(value: WindowFieldValues) => value.ends_at > value.starts_at,
		"End time must be after start time.",
	);

export type UpdateMaintenanceWindowValues = s.InferOutput<typeof UpdateMaintenanceWindowSchema>;

/** Validates the `delete-maintenance-window` and `end-maintenance-window` action form bodies. */
export const MaintenanceWindowIdSchema = f.object({ window_id: f.field(s.string()) });
