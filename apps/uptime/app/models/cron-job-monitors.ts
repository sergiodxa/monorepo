/**
 * Cron-job monitors (dead man's switches): a team's scheduled jobs, the sweep's actionable
 * set, and the single `recordPing` write the public ping endpoint uses. The monitor's own
 * `id` doubles as its public ping-URL identifier — see `docs/cron-job-monitoring.md`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { Schedule } from "@sdxc/cron";
import { createModel } from "@sdxc/data-model";
import { isFailure, unwrap } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";
import { inList, notNull } from "remix/data-table";

import { cronJobMonitors, cronJobPings } from "~/database/schema";

/**
 * The next expected run for a cron expression in a timezone, as epoch milliseconds — what
 * `next_expected_at` holds and the late/missed sweep compares against. `null` means the
 * expression or zone yields no valid time.
 *
 * @param cronExpression - The monitor's schedule.
 * @param timezone - IANA zone the schedule's wall-clock fields are read in.
 * @param from - Where the search starts, exclusive; defaults to now.
 * @example calculateNextExpected("0 9 * * *", "America/New_York");
 */
export function calculateNextExpected(
	cronExpression: string,
	timezone: string,
	from?: Date,
): number | null {
	let parsed = Schedule.parse(cronExpression);
	if (isFailure(parsed)) return null;

	let next = parsed.data.next({ from: from ?? new Date(), timeZone: timezone });
	if (Number.isNaN(next.getTime())) return null;

	return next.getTime();
}

/** What a ping's history row records about the request that delivered it. */
export interface PingMetadata {
	sourceIp: string | null;
	userAgent: string | null;
}

export const CronJobMonitors = createModel(cronJobMonitors, {
	optional: ["id", "grace_period_seconds", "timezone", "status", "alert_on_late"],

	scopes: {
		inTeam: (query, teamId: string) => query.where({ team_id: teamId }),

		/**
		 * Monitors the scheduled sweep evaluates: enabled, and `healthy` or `late`. Rows with a
		 * null `next_expected_at` are included so the sweep repairs them; omitting those once
		 * left five monitors green through a ten-day outage.
		 */
		actionable: (query) =>
			query.where(notNull("enabled_at")).where(inList("status", ["healthy", "late"])),
	},

	methods: {
		/** The monitors in `monitorIds` that belong to `teamId`; an empty list reads nothing. */
		async inTeamWithIds(teamId: string, monitorIds: string[]) {
			if (monitorIds.length === 0) return [];
			return await this.inTeam(teamId).where(inList("id", monitorIds)).all();
		},

		/**
		 * Records an inbound ping: inserts a history row and updates the monitor's
		 * `last_ping_at`, freshly computed `next_expected_at`, and status — `healthy` when on
		 * time, `late` otherwise. Only the scheduled sweep decides `missed`.
		 *
		 * @returns The history row's id, the idempotency key the ping meter bills against:
		 * everything the endpoint rejects returns before this write, and the id is the only
		 * thing about an accepted ping that is unique and already persisted.
		 */
		async recordPing(
			monitor: { id: string; cron_expression: string; timezone: string },
			wasOnTime: boolean,
			metadata: PingMetadata,
		): Promise<string> {
			let now = Date.now();
			let id = generateUUID();

			await this.db.create(
				cronJobPings,
				{
					id,
					cron_job_monitor_id: monitor.id,
					was_on_time: wasOnTime,
					source_ip: metadata.sourceIp,
					user_agent: metadata.userAgent,
				},
				{ touch: true },
			);

			unwrap(
				await this.update(monitor.id, {
					last_ping_at: now,
					next_expected_at: calculateNextExpected(monitor.cron_expression, monitor.timezone),
					status: wasOnTime ? "healthy" : "late",
				}),
			);

			return id;
		},
	},

	callbacks: {
		/**
		 * An enabled monitor starts measured against its schedule's next run; one created
		 * disabled has nothing to expect until it is turned on. An explicit value wins.
		 */
		async beforeCreate(values) {
			let nextExpectedAt =
				values.enabled_at != null && values.cron_expression
					? calculateNextExpected(values.cron_expression, values.timezone ?? "UTC")
					: null;
			return { next_expected_at: nextExpectedAt, ...values, id: values.id ?? generateUUID() };
		},

		/** Removes the monitor's ping history with it, which nothing else would ever reach. */
		async beforeDelete(row, ctx) {
			await ctx.models.cronJobPings.forMonitor(row.id).delete();
		},
	},
});

/** A cron-job monitor, as reads return it. */
export type CronJobMonitor = ModelRow<typeof CronJobMonitors>;

export default CronJobMonitors;
