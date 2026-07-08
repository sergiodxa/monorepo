/**
 * Form validation schemas for HTTP monitor create/update actions. `UpdateMonitorSchema`
 * extends the create fields with the target `monitor_id`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";
import * as f from "remix/data-schema/form-data";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"] as const;
const LOCATION_HINTS = ["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"] as const;

/** Field shape shared by the create and update monitor forms. */
const monitorFields = {
	name: f.field(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	url: f.field(s.string().pipe(checks.url())),
	method: f.field(s.defaulted(s.enum_(HTTP_METHODS), "HEAD")),
	expected_status: f.field(
		s.defaulted(coerce.number().pipe(checks.min(100), checks.max(599)), 200),
	),
	interval_seconds: f.field(
		s.defaulted(coerce.number().pipe(checks.min(60), checks.max(3600)), 60),
	),
	timeout_seconds: f.field(s.defaulted(coerce.number().pipe(checks.min(1), checks.max(60)), 10)),
	degraded_after_ms: f.field(
		s.defaulted(coerce.number().pipe(checks.min(1), checks.max(60_000)), 5000),
	),
	location_hint: f.field(s.defaulted(s.enum_(LOCATION_HINTS), "wnam")),
};

/** Validates the `create-monitor` action form body. */
export const CreateMonitorSchema = f.object(monitorFields);

export type CreateMonitorValues = s.InferOutput<typeof CreateMonitorSchema>;

/** Validates the `update-monitor` action form body. */
export const UpdateMonitorSchema = f.object({
	monitor_id: f.field(s.string()),
	...monitorFields,
});

export type UpdateMonitorValues = s.InferOutput<typeof UpdateMonitorSchema>;
