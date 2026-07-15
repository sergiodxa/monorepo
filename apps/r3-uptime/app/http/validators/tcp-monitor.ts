/**
 * Form validation schemas for TCP monitor create/update/delete/check actions.
 * `UpdateTcpMonitorSchema` extends the create fields with the target `monitor_id` and
 * its own `is_enabled` default: the create form has no enabled toggle at all (only the
 * edit form does — see `resources/views/tcp-monitors/form.tsx`), so a create always
 * defaults to enabled, matching the `tcp_monitors` table's own default. The edit form's
 * checkbox, being an HTML checkbox, is simply absent from the submitted body when
 * unchecked, so the update schema must default the *opposite* way — to `false` — for
 * unchecking "Enabled" to actually disable the monitor instead of silently no-op'ing.
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
	interval_seconds: f.field(
		s.defaulted(coerce.number().pipe(checks.min(10), checks.max(86_400)), 300),
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
