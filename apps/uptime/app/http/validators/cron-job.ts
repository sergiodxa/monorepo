/**
 * Form validation schemas for cron-job monitor create/update/delete actions.
 * `UpdateCronJobSchema` extends the create fields with the target `monitor_id`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";
import * as f from "remix/data-schema/form-data";

import {
	DEFAULT_TIMEZONE,
	isSupportedTimezone,
	UNKNOWN_TIMEZONE_MESSAGE,
} from "~/app/lib/timezones";

/** Field shape shared by the create and update cron-job monitor forms. */
const cronJobFields = {
	name: f.field(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	description: f.field(s.optional(s.string())),
	cron_expression: f.field(s.string().pipe(checks.minLength(1))),
	/*
	 * The zone is checked against the list rather than taken as free text: it decides
	 * when a job is considered late, so a typo that never matches a real zone would
	 * silently schedule against the wrong wall clock. `.refine()` runs at parse time,
	 * which also keeps the enumeration out of this module's own evaluation.
	 */
	timezone: f.field(
		s.defaulted(s.string().refine(isSupportedTimezone, UNKNOWN_TIMEZONE_MESSAGE), DEFAULT_TIMEZONE),
	),
	grace_period_seconds: f.field(
		s.defaulted(coerce.number().pipe(checks.min(60), checks.max(86_400)), 300),
	),
	alert_on_late: f.field(s.defaulted(coerce.boolean(), false)),
	is_enabled: f.field(s.defaulted(coerce.boolean(), false)),
};

/** Validates the `create-cron-job` action form body. */
export const CreateCronJobSchema = f.object(cronJobFields);

export type CreateCronJobValues = s.InferOutput<typeof CreateCronJobSchema>;

/** Validates the `update-cron-job` action form body. */
export const UpdateCronJobSchema = f.object({
	monitor_id: f.field(s.string()),
	...cronJobFields,
});

export type UpdateCronJobValues = s.InferOutput<typeof UpdateCronJobSchema>;

/** Validates the `delete-cron-job` action form body. */
export const CronJobIdSchema = f.object({ monitor_id: f.field(s.string()) });
