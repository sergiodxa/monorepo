/**
 * Data-access model for cron-job monitors (dead man's switch monitoring): CRUD over
 * `cron_job_monitors`, its `cron_job_pings` history, cron-expression scheduling with
 * `@pkg/cron`, and the single `recordPing` write path the public ping endpoint uses.
 * The monitor's own `id` doubles as its public ping-URL identifier — see
 * `docs/cron-job-monitoring.md`; there is no separate secret token.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { Schedule } from "@pkg/cron";
import { isFailure } from "@pkg/result";
import { generateUUID } from "@pkg/uuid";
import { and, eq, inList, notNull } from "remix/data-table";

import type { CronJobStatus, InsertCronJobMonitor } from "~/database/schema";

import { cronJobMonitors, cronJobPings } from "~/database/schema";

/** Most-recent pings shown on a monitor's detail page. */
const PING_HISTORY_LIMIT = 50;

/** Ping-history retention window, per `docs/cron-job-monitoring.md`. */
export const PING_RETENTION_DAYS = 365;

export default class CronJobMonitor {
	/** Creates a cron-job monitor for a team, computing `next_expected_at` when enabled. */
	static async create(db: Database, teamId: string, input: InsertCronJobMonitor) {
		let nextExpectedAt =
			input.enabled_at != null && input.cron_expression
				? CronJobMonitor.calculateNextExpected(input.cron_expression, input.timezone ?? "UTC")
				: null;

		return await db.create(
			cronJobMonitors,
			{ id: generateUUID(), team_id: teamId, next_expected_at: nextExpectedAt, ...input },
			{ touch: true, returnRow: true },
		);
	}

	/** Lists every cron-job monitor for a team, most recently created first. */
	static async listByTeam(db: Database, teamId: string) {
		return await db.findMany(cronJobMonitors, {
			where: { team_id: teamId },
			orderBy: ["created_at", "desc"],
		});
	}

	/** Finds a single cron-job monitor scoped to a team, or `null` when it's not theirs. */
	static async findByIdForTeam(db: Database, teamId: string, monitorId: string) {
		return await db.findOne(cronJobMonitors, { where: { id: monitorId, team_id: teamId } });
	}

	/** Finds a single cron-job monitor by id, regardless of team — used by the public ping endpoint. */
	static async findById(db: Database, monitorId: string) {
		return await db.findOne(cronJobMonitors, { where: { id: monitorId } });
	}

	/** Finds every cron-job monitor in `monitorIds` that belongs to `teamId`. */
	static async findManyByIdsForTeam(db: Database, teamId: string, monitorIds: string[]) {
		if (monitorIds.length === 0) return [];
		return await db.findMany(cronJobMonitors, {
			where: and(eq("team_id", teamId), inList("id", monitorIds)),
		});
	}

	/** Updates a cron-job monitor's editable fields. */
	static async updateById(db: Database, monitorId: string, changes: Partial<InsertCronJobMonitor>) {
		return await db.update(cronJobMonitors, monitorId, changes, { touch: true });
	}

	/** Deletes a cron-job monitor and its ping history. */
	static async deleteById(db: Database, monitorId: string) {
		let pings = await db.findMany(cronJobPings, { where: { cron_job_monitor_id: monitorId } });
		for (let ping of pings) await db.delete(cronJobPings, ping.id);
		return await db.delete(cronJobMonitors, monitorId);
	}

	/** Lists a monitor's most recent pings, newest first. */
	static async listPings(db: Database, monitorId: string) {
		return await db.findMany(cronJobPings, {
			where: { cron_job_monitor_id: monitorId },
			orderBy: ["created_at", "desc"],
			limit: PING_HISTORY_LIMIT,
		});
	}

	/**
	 * Lists monitors the scheduled `CheckCronJobsJob` sweep should evaluate: enabled, and
	 * not already `missed` (a `missed` monitor stays that way until its next on-time ping)
	 * or `new` (which only leaves `new` once it receives a first ping).
	 *
	 * Deliberately does **not** require an expected-arrival time. It used to, and that was
	 * a hole big enough to hide a ten-day outage: a row with a null `next_expected_at` was
	 * never selected, so the sweep never evaluated it, so it never left `healthy` — and
	 * five monitors sat green for ten days while nothing was pinging them at all. A
	 * monitor with nothing to be on time against is not healthy, it is unmeasurable, and
	 * the sweep is the only thing positioned to notice. It repairs the row instead; see
	 * `CheckCronJobsJob.evaluate`.
	 */
	static async listActionable(db: Database) {
		return await db.findMany(cronJobMonitors, {
			where: and(notNull("enabled_at"), inList("status", ["healthy", "late"])),
		});
	}

	/**
	 * Sets a monitor's expected-arrival time without touching its status, used by the
	 * sweep to repair a row that has none. Separate from {@link updateStatus} because
	 * repairing what a monitor is measured against is not a statement about its health:
	 * the monitor keeps whatever status it had, and the next pass judges it normally.
	 */
	static async setNextExpected(db: Database, monitorId: string, nextExpectedAt: number) {
		return await db.update(
			cronJobMonitors,
			monitorId,
			{ next_expected_at: nextExpectedAt },
			{ touch: true },
		);
	}

	/** Sets a monitor's status directly, used by the scheduled late/missed sweep. */
	static async updateStatus(db: Database, monitorId: string, status: CronJobStatus) {
		return await db.update(cronJobMonitors, monitorId, { status }, { touch: true });
	}

	/**
	 * Records an inbound ping: inserts a history row and updates the monitor's
	 * `last_ping_at`, freshly computed `next_expected_at`, and status (`healthy` when
	 * on time, `late` otherwise — never set directly to `missed`, which only the
	 * scheduled sweep decides once a job goes silent past its grace period).
	 *
	 * @returns The history row's id. Reaching this method is what makes a ping billable —
	 * everything the endpoint rejects returns before it — and the row's id is the only
	 * thing about an accepted ping that is unique and already persisted, which is what
	 * makes it the idempotency key the ping meter bills against. A caller that retries its
	 * `curl` would be refused by the per-minute rule rather than reaching a second insert.
	 */
	static async recordPing(
		db: Database,
		monitor: { id: string; cron_expression: string; timezone: string },
		wasOnTime: boolean,
		metadata: { sourceIp: string | null; userAgent: string | null },
	): Promise<string> {
		let now = Date.now();
		let id = generateUUID();

		await db.create(
			cronJobPings,
			{
				id,
				cron_job_monitor_id: monitor.id,
				was_on_time: wasOnTime,
				source_ip: metadata.sourceIp,
				user_agent: metadata.userAgent,
			},
			{ touch: true, returnRow: true },
		);

		let nextExpectedAt = CronJobMonitor.calculateNextExpected(
			monitor.cron_expression,
			monitor.timezone,
		);

		await db.update(
			cronJobMonitors,
			monitor.id,
			{
				last_ping_at: now,
				next_expected_at: nextExpectedAt,
				status: wasOnTime ? "healthy" : "late",
			},
			{ touch: true },
		);

		return id;
	}

	/**
	 * The next expected run for a cron expression evaluated in a timezone, as epoch
	 * milliseconds — the value `next_expected_at` holds and the late/missed sweep
	 * compares against.
	 *
	 * `null` when there is no answer to store: an expression that no longer parses, or
	 * a `timezone` the runtime doesn't know (the column is free-form text, so a stale
	 * zone name is reachable). Both leave the monitor unscheduled rather than writing a
	 * timestamp that isn't a time.
	 *
	 * @param cronExpression - The monitor's schedule.
	 * @param timezone - IANA zone the schedule's wall-clock fields are read in.
	 * @param from - Where the search starts, exclusive; defaults to now.
	 * @returns The next run in epoch milliseconds, or `null`.
	 *
	 * @example
	 * CronJobMonitor.calculateNextExpected("0 9 * * *", "America/New_York");
	 */
	static calculateNextExpected(
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
}
