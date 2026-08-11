/**
 * Form validation schemas for the DNS monitor actions: create, update, delete, the manual
 * check, the review step, a single record toggle, and a zone-file re-import. A monitor
 * covers a whole domain, so there is no record type and no transcribed expected value to
 * validate — the expectation is imported, not typed.
 *
 * `UpdateDnsMonitorSchema` extends the create fields with the target `monitor_id` and its
 * own `is_enabled` default, for the reason every edit form here shares: an unchecked HTML
 * checkbox is simply absent from the body, so an update must default to `false` for
 * unchecking "Enabled" to disable the monitor instead of silently no-op'ing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";
import * as f from "remix/data-schema/form-data";

/**
 * Shortest interval a domain monitor may be configured with (ADR-026 §2).
 *
 * Deliberately far above the 60 seconds the other monitor types floor at, because a domain
 * monitor is not one query: it sweeps six record types at every tracked name, so a minute's
 * interval on a single monitor is hundreds of thousands of lookups a month against a
 * resolver we do not pay for and must not abuse. It also replaces a floor that disagreed
 * with itself — the form enforced 300 while the API allowed 60 — so both now read this.
 */
export const MIN_DNS_INTERVAL_SECONDS = 900;

/** Longest interval, and the default: DNS changes are human-caused and human-paced. */
export const MAX_DNS_INTERVAL_SECONDS = 86_400;

/** Once a day, matching the `dns_monitors.interval_seconds` column's own default. */
export const DEFAULT_DNS_INTERVAL_SECONDS = 86_400;

/** Field shape shared by the create and update DNS monitor forms, minus `is_enabled`. */
const dnsMonitorFields = {
	name: f.field(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	domain: f.field(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	interval_seconds: f.field(
		s.defaulted(
			coerce
				.number()
				.pipe(checks.min(MIN_DNS_INTERVAL_SECONDS), checks.max(MAX_DNS_INTERVAL_SECONDS)),
			DEFAULT_DNS_INTERVAL_SECONDS,
		),
	),
};

/**
 * The pasted zone file, which is optional because a monitor without one still covers its
 * apex. Its size is not checked here: the cap is a byte count, this sees characters, and
 * the parser is the one place that can refuse a paste for being too large and say so with
 * the real figure.
 */
const zoneFileField = f.field(s.optional(s.string()));

/**
 * Validates the `create-dns-monitor` action form body.
 *
 * `is_enabled` defaults to `true`: the visitor reaches the review screen straight after
 * this, and a user who has just chosen which records to watch has plainly enabled the
 * monitor. The old default of `false` made a monitor that was created and then never ran.
 */
export const CreateDnsMonitorSchema = f.object({
	...dnsMonitorFields,
	is_enabled: f.field(s.defaulted(coerce.boolean(), true)),
	zone_file: zoneFileField,
});

export type CreateDnsMonitorValues = s.InferOutput<typeof CreateDnsMonitorSchema>;

/**
 * Validates the `update-dns-monitor` action form body. No zone file: the text is never
 * stored, so re-importing one is its own deliberate action rather than a field somebody
 * submits again every time they rename a monitor.
 */
export const UpdateDnsMonitorSchema = f.object({
	monitor_id: f.field(s.string()),
	...dnsMonitorFields,
	is_enabled: f.field(s.defaulted(coerce.boolean(), false)),
});

export type UpdateDnsMonitorValues = s.InferOutput<typeof UpdateDnsMonitorSchema>;

/** Validates the `delete-dns-monitor` and `check-dns-monitor` action form bodies. */
export const DnsMonitorIdSchema = f.object({ monitor_id: f.field(s.string()) });

/**
 * Validates the `review-dns-monitor` action form body: every checkbox the visitor left
 * checked, read with `f.fields()` because an HTML checkbox group submits one entry per box.
 *
 * `record_ids` is defaulted rather than required, since unchecking every record is a real
 * decision — "watch none of this" — and an empty body is exactly how a browser expresses it.
 */
export const ReviewDnsMonitorSchema = f.object({
	monitor_id: f.field(s.string()),
	record_ids: f.fields(s.defaulted(s.array(s.string()), [])),
});

export type ReviewDnsMonitorValues = s.InferOutput<typeof ReviewDnsMonitorSchema>;

/**
 * Validates the `toggle-dns-monitor-record` action form body. `is_enabled` defaults to
 * `false` for the same absent-checkbox reason as the update form.
 */
export const ToggleDnsMonitorRecordSchema = f.object({
	monitor_id: f.field(s.string()),
	record_id: f.field(s.string()),
	is_enabled: f.field(s.defaulted(coerce.boolean(), false)),
});

export type ToggleDnsMonitorRecordValues = s.InferOutput<typeof ToggleDnsMonitorRecordSchema>;

/**
 * Validates the `import-dns-monitor-zone-file` action form body. The paste is required
 * here — an empty one would be a no-op that still reported an import — and is discarded as
 * soon as it has been parsed.
 */
export const ImportDnsMonitorZoneFileSchema = f.object({
	monitor_id: f.field(s.string()),
	zone_file: f.field(s.string().pipe(checks.minLength(1))),
});

export type ImportDnsMonitorZoneFileValues = s.InferOutput<typeof ImportDnsMonitorZoneFileSchema>;
