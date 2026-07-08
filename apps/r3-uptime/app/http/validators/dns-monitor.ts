/**
 * Form validation schemas for DNS monitor create/update/delete/check actions.
 * `UpdateDnsMonitorSchema` extends the create fields with the target `monitor_id`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";
import * as f from "remix/data-schema/form-data";

const DNS_RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS"] as const;

/** Field shape shared by the create and update DNS monitor forms. */
const dnsMonitorFields = {
	name: f.field(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	domain: f.field(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	record_type: f.field(s.enum_(DNS_RECORD_TYPES)),
	expected_value: f.field(s.optional(s.string())),
	interval_seconds: f.field(
		s.defaulted(coerce.number().pipe(checks.min(300), checks.max(86_400)), 3600),
	),
	is_enabled: f.field(s.defaulted(coerce.boolean(), false)),
};

/** Validates the `create-dns-monitor` action form body. */
export const CreateDnsMonitorSchema = f.object(dnsMonitorFields);

export type CreateDnsMonitorValues = s.InferOutput<typeof CreateDnsMonitorSchema>;

/** Validates the `update-dns-monitor` action form body. */
export const UpdateDnsMonitorSchema = f.object({
	monitor_id: f.field(s.string()),
	...dnsMonitorFields,
});

export type UpdateDnsMonitorValues = s.InferOutput<typeof UpdateDnsMonitorSchema>;

/** Validates the `delete-dns-monitor` and `check-dns-monitor` action form bodies. */
export const DnsMonitorIdSchema = f.object({ monitor_id: f.field(s.string()) });
