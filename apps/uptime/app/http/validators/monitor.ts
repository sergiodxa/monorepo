/**
 * Form validation schemas for the HTTP monitor create/update web-form actions.
 * `UpdateMonitorSchema` extends the create fields with the target `monitor_id`. The
 * form only collects name/URL/interval/expected-status/region — method, timeout and
 * degraded-threshold aren't exposed there, so a create leaves them at their table
 * defaults and an update leaves an existing monitor's values untouched. The JSON API
 * (`app/http/controllers/api/monitor.ts` and `api/monitors.ts`) has its own, more
 * permissive schemas that do accept those fields.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";
import * as f from "remix/data-schema/form-data";

const LOCATION_HINTS = ["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"] as const;

/**
 * Query parameter the new-monitor page pre-fills its `url` field from, so a URL the viewer
 * has already handed us somewhere else does not have to be typed a second time.
 *
 * Named for the field it fills, and declared here rather than beside either page because
 * two of them spell it — one writing the link and one reading it — and a name spelled two
 * ways is a pre-fill that silently does nothing.
 */
export const MONITOR_URL_PREFILL = "url";

/** Field shape shared by the create and update monitor web forms. */
const monitorFields = {
	name: f.field(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	url: f.field(s.string().pipe(checks.url())),
	expected_status: f.field(
		s.defaulted(coerce.number().pipe(checks.min(100), checks.max(599)), 200),
	),
	interval_seconds: f.field(
		s.defaulted(coerce.number().pipe(checks.min(60), checks.max(3600)), 600),
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
