/**
 * Form validation schemas for status-page create/update/delete actions. `slug` is
 * restricted to URL-safe characters (`docs/status-pages.md`); the five id-list
 * fields read every checked checkbox sharing that `name` via `f.fields()`, which is
 * how the curated monitor/DNS/TCP/flow/cron-job attachment lists are resubmitted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";
import * as f from "remix/data-schema/form-data";

const SLUG_PATTERN = /^[a-z0-9-]+$/;

/** Field shape shared by the create and update status-page forms. */
const statusPageFields = {
	name: f.field(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	slug: f.field(
		s
			.string()
			.pipe(checks.minLength(1), checks.maxLength(63))
			.refine(
				(value: string) => SLUG_PATTERN.test(value),
				"Use lowercase letters, numbers, and hyphens only.",
			),
	),
	title: f.field(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	description: f.field(s.optional(s.string())),
	logo_url: f.field(s.optional(s.string())),
	is_public: f.field(s.defaulted(coerce.boolean(), true)),
	show_overall_status: f.field(s.defaulted(coerce.boolean(), true)),
	monitor_ids: f.fields(s.array(s.string())),
	dns_monitor_ids: f.fields(s.array(s.string())),
	tcp_monitor_ids: f.fields(s.array(s.string())),
	flow_monitor_ids: f.fields(s.array(s.string())),
	cron_job_ids: f.fields(s.array(s.string())),
};

/** Validates the `create-status-page` action form body. */
export const CreateStatusPageSchema = f.object(statusPageFields);

export type CreateStatusPageValues = s.InferOutput<typeof CreateStatusPageSchema>;

/** Validates the `update-status-page` action form body. */
export const UpdateStatusPageSchema = f.object({
	status_page_id: f.field(s.string()),
	...statusPageFields,
});

export type UpdateStatusPageValues = s.InferOutput<typeof UpdateStatusPageSchema>;

/** Validates the `delete-status-page` action form body. */
export const StatusPageIdSchema = f.object({ status_page_id: f.field(s.string()) });
