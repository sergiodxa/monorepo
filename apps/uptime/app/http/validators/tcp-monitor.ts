/**
 * Form validation schemas for TCP monitor create/update/delete/check actions.
 * `UpdateTcpMonitorSchema` defaults `is_enabled` to `false` so an unchecked
 * edit-form checkbox (absent from the submitted body) disables the monitor;
 * `CreateTcpMonitorSchema` defaults it to `true`, matching the table default.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";
import * as f from "remix/data-schema/form-data";

/** Field shape shared by the create and update TCP monitor forms, minus `is_enabled` (see the module docstring for why its default differs between the two). */
const tcpMonitorFields = {
	name: f.field(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	host: f.field(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	port: f.field(coerce.number().pipe(checks.min(1), checks.max(65_535))),
	timeout_ms: f.field(s.defaulted(coerce.number().pipe(checks.min(100), checks.max(60_000)), 5000)),
	/**
	 * Floored at 60 seconds, matching the HTTP monitor form: checks are delivered by an
	 * every-minute cron, so an interval finer than a minute is not schedulable and would
	 * be billed for checks that could never run (ADR-006).
	 */
	interval_seconds: f.field(
		s.defaulted(coerce.number().pipe(checks.min(60), checks.max(86_400)), 300),
	),
};

/** Validates the `create-tcp-monitor` action form body. */
export const CreateTcpMonitorSchema = f.object({
	...tcpMonitorFields,
	is_enabled: f.field(s.defaulted(coerce.boolean(), true)),
});

export type CreateTcpMonitorValues = s.InferOutput<typeof CreateTcpMonitorSchema>;

/** Validates the `update-tcp-monitor` action form body. */
export const UpdateTcpMonitorSchema = f.object({
	monitor_id: f.field(s.string()),
	...tcpMonitorFields,
	is_enabled: f.field(s.defaulted(coerce.boolean(), false)),
});

export type UpdateTcpMonitorValues = s.InferOutput<typeof UpdateTcpMonitorSchema>;

/** Validates the `delete-tcp-monitor` and `check-tcp-monitor` action form bodies. */
export const TcpMonitorIdSchema = f.object({ monitor_id: f.field(s.string()) });
