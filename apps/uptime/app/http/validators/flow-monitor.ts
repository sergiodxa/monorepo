/**
 * Form validation schemas for flow monitor create/update/delete actions.
 *
 * Two things are shaped by the form rather than by the table. `interval_seconds` is validated
 * as one of the seven values `FLOW_INTERVALS_SECONDS` lists rather than as a bounded number:
 * the control is a select, so anything else is a hand-built request, and a flow interval is a
 * commercial term with a price beside each option (ADR-027 §7a). And `is_enabled` defaults
 * the opposite way between the two schemas — the create form has no toggle, so a create
 * defaults to enabled like the column does, while the edit form's checkbox is simply absent
 * from the body when unchecked, so an update has to default to `false` for unchecking
 * "Enabled" to actually disable the monitor instead of silently no-op'ing.
 *
 * What a source is *allowed to reach* is deliberately not validated here. It depends on the
 * team's verified domains, which a schema cannot see, so it lives in `inspectFlowSource` and
 * the action calls it — the same function the sweep uses, so the form and the check can never
 * disagree about which monitors are runnable.
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
 * How long a spec source may be.
 *
 * Generous relative to any real flow — the 20-request ceiling puts a much tighter bound on
 * what a source can usefully say — and present so a pasted file cannot become a row nothing
 * will render.
 */
const MAX_SOURCE_LENGTH = 20_000;

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
