/**
 * Data-access model for cron-job monitors (dead man's switch monitoring): CRUD over
 * `cron_job_monitors`, its `cron_job_pings` history, cron-expression scheduling via
 * `cron-parser`, and the single `recordPing` write path the public ping endpoint uses.
 * The monitor's own `id` doubles as its public ping-URL identifier — see
 * `docs/cron-job-monitoring.md`; there is no separate secret token.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { CronExpressionParser } from "cron-parser";
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
			{ id: crypto.randomUUID(), team_id: teamId, next_expected_at: nextExpectedAt, ...input },
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
	 * Lists monitors the scheduled `CheckCronJobsJob` sweep should evaluate: enabled,
	 * with an expected-arrival time, and not already `missed` (a `missed` monitor stays
	 * that way until its next on-time ping) or `new` (which only leaves `new` once it
	 * receives a first ping).
	 */
	static async listActionable(db: Database) {
		return await db.findMany(cronJobMonitors, {
			where: and(
				notNull("enabled_at"),
				notNull("next_expected_at"),
				inList("status", ["healthy", "late"]),
			),
		});
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
	 */
	static async recordPing(
		db: Database,
		monitor: { id: string; cron_expression: string; timezone: string },
		wasOnTime: boolean,
		metadata: { sourceIp: string | null; userAgent: string | null },
	) {
		let now = Date.now();

		await db.create(
			cronJobPings,
			{
				id: crypto.randomUUID(),
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
	}

	/** Computes the next expected run time for a cron expression in a timezone. */
	static calculateNextExpected(cronExpression: string, timezone: string, from?: Date): number {
		let interval = CronExpressionParser.parse(cronExpression, {
			currentDate: from ?? new Date(),
			tz: timezone,
		});
		return interval.next().toDate().getTime();
	}

	/** Throws if `cronExpression` isn't a valid 5-field cron expression. */
	static validateCronExpression(cronExpression: string, timezone: string): void {
		CronExpressionParser.parse(cronExpression, { tz: timezone });
	}

	/** Renders a cron expression as a short human-readable schedule description. */
	static describeCronExpression(cronExpression: string): string {
		let shortcuts: Record<string, string> = {
			"@yearly": "Every year on January 1st at midnight",
			"@annually": "Every year on January 1st at midnight",
			"@monthly": "Every month on the 1st at midnight",
			"@weekly": "Every Sunday at midnight",
			"@daily": "Every day at midnight",
			"@midnight": "Every day at midnight",
			"@hourly": "Every hour",
		};
		let shortcut = shortcuts[cronExpression];
		if (shortcut) return shortcut;

		let parts = cronExpression.trim().split(/\s+/);
		if (parts.length !== 5) return genericDescription(cronExpression);

		let [minute = "", hour = "", dayOfMonth = "", month = "", dayOfWeek = ""] = parts;

		if (cronExpression === "* * * * *") return "Every minute";

		if (hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
			if (minute === "0") return "Every hour";
			if (minute === "*") return "Every minute";
			if (minute.includes("/")) return `Every ${minute.split("/")[1]} minutes`;
			if (/^\d+$/.test(minute)) return `Every hour at minute ${minute}`;
		}

		if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
			if (minute === "0" && hour === "0") return "Every day at midnight";
			if (minute === "0" && /^\d+$/.test(hour)) return `Every day at ${hour}:00`;
			if (/^\d+$/.test(minute) && /^\d+$/.test(hour)) {
				return `Every day at ${hour}:${minute.padStart(2, "0")}`;
			}
		}

		if (dayOfMonth === "*" && month === "*" && dayOfWeek !== "*") {
			let weekdayNames = [
				"Sunday",
				"Monday",
				"Tuesday",
				"Wednesday",
				"Thursday",
				"Friday",
				"Saturday",
			];
			let weekdayName = /^\d+$/.test(dayOfWeek)
				? (weekdayNames[Number(dayOfWeek)] ?? dayOfWeek)
				: dayOfWeek;
			if (minute === "0" && hour === "0") return `Every ${weekdayName} at midnight`;
			if (minute === "0" && /^\d+$/.test(hour)) return `Every ${weekdayName} at ${hour}:00`;
		}

		if (month === "*" && dayOfWeek === "*" && /^\d+$/.test(dayOfMonth)) {
			if (minute === "0" && hour === "0") return `Monthly on day ${dayOfMonth} at midnight`;
		}

		return genericDescription(cronExpression);
	}
}

function genericDescription(cronExpression: string): string {
	try {
		let next = CronExpressionParser.parse(cronExpression).next().toDate();
		return `Scheduled (next: ${next.toISOString()})`;
	} catch {
		return "Custom schedule";
	}
}
