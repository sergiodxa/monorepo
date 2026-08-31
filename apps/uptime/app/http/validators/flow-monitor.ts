/**
 * Form validation schemas for flow monitor create/update/delete actions.
 *
 * `interval_seconds` accepts one of the seven `FLOW_INTERVALS_SECONDS` values instead of a
 * bounded number, since the control is a select and each option carries its own price
 * (ADR-027 §7a). `is_enabled` defaults oppositely per schema: create defaults to enabled
 * like the column does, while update defaults to `false`, since an unchecked checkbox
 * submits nothing and only an explicit `false` can disable an existing monitor.
 *
 * What a source may reach is validated by `inspectFlowSource`, shared by the action and the
 * sweep so the form and the runtime check can never disagree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";
import * as f from "remix/data-schema/form-data";

import { DEFAULT_FLOW_INTERVAL_SECONDS, FLOW_INTERVALS_SECONDS } from "~/app/lib/pricing";

/**
 * The selectable intervals as the strings a `<select>` submits.
 *
 * Derived from {@link FLOW_INTERVALS_SECONDS} rather than written out, so the option list and
 * the schema that accepts it cannot fall out of step.
 */
const INTERVAL_VALUES = FLOW_INTERVALS_SECONDS.map(String) as [string, ...string[]];

/**
 * How long a spec source may be, generous relative to any real flow since the 20-request
 * ceiling already bounds what a source can usefully say — present only so a pasted file
 * cannot become a row that renders nothing.
 */
export const MAX_SOURCE_LENGTH = 20_000;

/** Field shape shared by the create and update forms, minus `is_enabled`. */
const flowMonitorFields = {
	name: f.field(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	source: f.field(s.string().pipe(checks.minLength(1), checks.maxLength(MAX_SOURCE_LENGTH))),
	interval_seconds: f.field(
		s.defaulted(s.enum_(INTERVAL_VALUES), String(DEFAULT_FLOW_INTERVAL_SECONDS)),
	),
};

/** Validates the `create-flow-monitor` action form body. */
export const CreateFlowMonitorSchema = f.object({
	...flowMonitorFields,
	is_enabled: f.field(s.defaulted(coerce.boolean(), true)),
});

export type CreateFlowMonitorValues = s.InferOutput<typeof CreateFlowMonitorSchema>;

/** Validates the `update-flow-monitor` action form body. */
export const UpdateFlowMonitorSchema = f.object({
	monitor_id: f.field(s.string()),
	...flowMonitorFields,
	is_enabled: f.field(s.defaulted(coerce.boolean(), false)),
});

export type UpdateFlowMonitorValues = s.InferOutput<typeof UpdateFlowMonitorSchema>;

/** Validates the `delete-flow-monitor` action form body. */
export const FlowMonitorIdSchema = f.object({ monitor_id: f.field(s.string()) });
