/**
 * Form validation schemas for TCP monitor create/update/delete/check actions.
 * `UpdateTcpMonitorSchema` extends the create fields with the target `monitor_id`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";
import * as f from "remix/data-schema/form-data";

/** Field shape shared by the create and update TCP monitor forms. */
const tcpMonitorFields = {
	name: f.field(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	host: f.field(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	port: f.field(coerce.number().pipe(checks.min(1), checks.max(65_535))),
	timeout_ms: f.field(s.defaulted(coerce.number().pipe(checks.min(100), checks.max(60_000)), 5000)),
	interval_seconds: f.field(
		s.defaulted(coerce.number().pipe(checks.min(10), checks.max(86_400)), 60),
	),
	is_enabled: f.field(s.defaulted(coerce.boolean(), false)),
};

/** Validates the `create-tcp-monitor` action form body. */
export const CreateTcpMonitorSchema = f.object(tcpMonitorFields);

export type CreateTcpMonitorValues = s.InferOutput<typeof CreateTcpMonitorSchema>;

/** Validates the `update-tcp-monitor` action form body. */
export const UpdateTcpMonitorSchema = f.object({
	monitor_id: f.field(s.string()),
	...tcpMonitorFields,
});

export type UpdateTcpMonitorValues = s.InferOutput<typeof UpdateTcpMonitorSchema>;

/** Validates the `delete-tcp-monitor` and `check-tcp-monitor` action form bodies. */
export const TcpMonitorIdSchema = f.object({ monitor_id: f.field(s.string()) });
