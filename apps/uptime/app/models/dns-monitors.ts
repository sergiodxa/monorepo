/**
 * DNS monitors: a team's watched zones, the claim each sweep runs to take the monitors whose
 * `interval_seconds` has come round, the registration lookups leased per domain, and the
 * single `recordCheckResult` write both the scheduled job and "Check now" use.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";
import { unwrap } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";
import { getTableName } from "remix/data-table";

import type { SelectDnsMonitor, SelectDnsMonitorResult } from "~/database/schema";

import { claimDue, nextDueAtOnEnable, nextDueAtPatch } from "~/app/lib/scheduling";
import { dnsMonitorResults, dnsMonitors } from "~/database/schema";

/**
 * How long a claimed registration lookup holds its monitor before another sweep may take it:
 * the lookup writes its real next time well within this, so the lease only matters when a
 * sweep dies mid-batch or a delivery is replayed.
 */
const REGISTRATION_LEASE_MS = 60 * 60 * 1000;

/**
 * What a registration lookup reads, projected so `team_id` (whose cost) and `name` (the alert
 * body) cost no second read. Only non-boolean, non-JSON columns, which arrive as stored.
 */
const REGISTRATION_CLAIM_COLUMNS = [
	"id",
	"team_id",
	"name",
	"domain",
	"registration_status",
	"registration_expires_at",
	"registration_warning_days",
	"registration_checked_at",
	"registration_failures",
] as const;

/** A DNS monitor claimed for a registration lookup, projected to the columns it reads. */
export type ClaimedRegistration = Pick<
	SelectDnsMonitor,
	(typeof REGISTRATION_CLAIM_COLUMNS)[number]
>;

/** Per-team limit from `docs/dns-monitors.md`. */
export const MAX_DNS_MONITORS_PER_TEAM = 20;

/**
 * What a claimed monitor's check reads, projected so `team_id` (whose cost), `name` (the
 * alert body) and `zone_file_imported_at` (how names were found) cost no second read. Only
 * non-boolean columns: values arrive as the database holds them, booleans as 0/1.
 */
const CLAIM_COLUMNS = [
	"id",
	"team_id",
	"name",
	"domain",
	"zone_file_imported_at",
	"last_status",
] as const;

/** A DNS monitor claimed for a check, projected to the columns the check reads. */
export type ClaimedDnsMonitor = Pick<SelectDnsMonitor, (typeof CLAIM_COLUMNS)[number]>;

/**
 * What a completed check reports to this table: one status, the slowest query's latency,
 * and the per-record counters. Owned by the table, so its shape moves only when what a
 * result row means moves; omitted counters fall back to the columns' zero defaults.
 */
export interface DnsCheckOutcome {
	status: SelectDnsMonitorResult["status"];
	/** The slowest single query, which is what a latency chart plots. */
	responseTimeMs: number | null;
	errorMessage?: string | null;
	recordsChecked?: number;
	recordsChanged?: number;
	recordsMissing?: number;
	recordsNew?: number;
	/** Queries that failed, leaving their records at the state the check found them in. */
	queriesFailed?: number;
}

export const DnsMonitors = createModel(dnsMonitors, {
	optional: [
		"id",
		"interval_seconds",
		"is_enabled",
		"registration_status",
		"registration_warning_days",
		"registration_failures",
	],

	scopes: {
		inTeam: (query, teamId: string) => query.where({ team_id: teamId }),
	},

	methods: {
		/**
		 * Claims every DNS monitor whose next check is due as of `scheduledAt`, across every team,
		 * advancing each one's next due time as it does, so concurrent deliveries never claim the
		 * same monitor twice.
		 */
		claimDue(scheduledAt: number) {
			return claimDue(this.db, dnsMonitors, CLAIM_COLUMNS, scheduledAt);
		},

		/**
		 * Records a check's outcome: inserts a history row and updates the monitor's cached
		 * "last checked" fields in one call. Counters a caller omits stay at the column default
		 * of zero, a truthful "this check measured none of that".
		 *
		 * @returns The history row's id. It is the only thing about a completed check that is
		 * unique and already persisted, which is what makes it the idempotency key the ping meter
		 * bills against: a redelivery of the same recorded check meters once.
		 */
		async recordCheckResult(monitorId: string, result: DnsCheckOutcome): Promise<string> {
			let checkedAt = Date.now();
			let id = generateUUID();

			await this.db.create(
				dnsMonitorResults,
				{
					id,
					dns_monitor_id: monitorId,
					status: result.status,
					records_checked: result.recordsChecked ?? 0,
					records_changed: result.recordsChanged ?? 0,
					records_missing: result.recordsMissing ?? 0,
					records_new: result.recordsNew ?? 0,
					queries_failed: result.queriesFailed ?? 0,
					response_time_ms: result.responseTimeMs,
					error_message: result.errorMessage ?? null,
					checked_at: checkedAt,
				},
				{ touch: true },
			);

			unwrap(
				await this.update(monitorId, { last_checked_at: checkedAt, last_status: result.status }),
			);

			return id;
		},

		/**
		 * Claims up to `limit` enabled monitors whose registration lookup is due, oldest due first,
		 * leasing each for an hour so an overlapping sweep cannot look the same domain up twice.
		 * A monitor never looked up (`NULL`) is due at once.
		 */
		async claimRegistrationDue(now: number, limit: number): Promise<ClaimedRegistration[]> {
			let table = getTableName(dnsMonitors);
			let claimed = await this.db.exec(
				`UPDATE ${table}
				    SET registration_next_check_at = ?
				  WHERE id IN (
				        SELECT id FROM ${table}
				         WHERE is_enabled = 1
				           AND (registration_next_check_at IS NULL OR registration_next_check_at <= ?)
				         ORDER BY coalesce(registration_next_check_at, 0)
				         LIMIT ?)
				RETURNING ${REGISTRATION_CLAIM_COLUMNS.join(", ")}`,
				[now + REGISTRATION_LEASE_MS, now, limit],
			);

			return (claimed.rows ?? []) as unknown as ClaimedRegistration[];
		},
	},

	callbacks: {
		/**
		 * A new monitor is enabled unless the caller says otherwise (matching the column's own
		 * default) and due at once, so it reports a status on the next cron tick.
		 */
		async beforeCreate(values) {
			return {
				...values,
				id: values.id ?? generateUUID(),
				next_due_at: nextDueAtOnEnable(values.is_enabled ?? true),
			};
		},

		/**
		 * Keeps `next_due_at` consistent with an edit that changes whether or how often the
		 * monitor runs. A new registration warning window reclassifies the stored expiry date, so
		 * it also makes the registration due on the next sweep.
		 */
		async beforeUpdate(values, ctx, before) {
			let patch = await nextDueAtPatch(ctx.db, dnsMonitors, before.id, {
				enabled: values.is_enabled,
				intervalSeconds: values.interval_seconds,
			});
			let registration =
				values.registration_warning_days === undefined ? {} : { registration_next_check_at: null };
			return { ...values, ...patch, ...registration };
		},

		/**
		 * Removes the monitor's tracked records and check history before the monitor itself: the
		 * retention sweep visits history alone and the records are configuration, so a row left
		 * behind would outlive its monitor forever.
		 */
		async beforeDelete(row, ctx) {
			await ctx.models.dnsMonitorRecords.forMonitor(row.id).delete();
			await ctx.models.dnsMonitorResults.forMonitor(row.id).delete();
		},
	},
});

/** A DNS monitor, as reads return it. */
export type DnsMonitor = ModelRow<typeof DnsMonitors>;

export default DnsMonitors;
