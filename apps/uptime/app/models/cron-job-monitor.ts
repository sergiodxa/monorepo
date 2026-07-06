/**
 * The data-access model for cron job (heartbeat) monitors, exposing static methods over the
 * Drizzle database: CRUD, per-team listing and counting, ping recording with rate limiting
 * and on-time detection, overdue/late/missed status computation, ping statistics, cleanup,
 * and cron-expression helpers that compute the next run and produce human-readable schedule
 * descriptions. It centralizes all cron-monitor persistence and scheduling logic.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { CronExpressionParser } from "cron-parser";
import { count, eq, lt, sql } from "drizzle-orm";

import type { Database } from "~/db/index";

import * as schema from "~/db/schema";

const ONE_MINUTE_MS = 60 * 1000;

export default class CronJobMonitor {
	// CRUD

	static async create(
		db: Database,
		data: Omit<schema.InsertCronJobMonitor, "id" | "createdAt" | "updatedAt">,
	): Promise<schema.SelectCronJobMonitor> {
		let [monitor] = await db.insert(schema.cronJobMonitors).values(data).returning();

		if (monitor) return monitor;
		throw new Error("Failed to create cron job monitor");
	}

	static async findById(db: Database, id: string): Promise<schema.SelectCronJobMonitor | null> {
		let monitor = await db.query.cronJobMonitors.findFirst({
			where(fields, operators) {
				return operators.eq(fields.id, id);
			},
		});

		return monitor ?? null;
	}

	static async findByIdAndTeam(
		db: Database,
		id: string,
		teamId: string,
	): Promise<schema.SelectCronJobMonitor | null> {
		let monitor = await db.query.cronJobMonitors.findFirst({
			where(fields, operators) {
				return operators.and(operators.eq(fields.id, id), operators.eq(fields.teamId, teamId));
			},
		});

		return monitor ?? null;
	}

	static async listByTeam(
		db: Database,
		teamId: string,
	): Promise<Array<schema.SelectCronJobMonitor>> {
		return db.query.cronJobMonitors.findMany({
			where(fields, operators) {
				return operators.eq(fields.teamId, teamId);
			},
			orderBy(fields, operators) {
				return operators.desc(fields.createdAt);
			},
		});
	}

	static async countByTeam(db: Database, teamId: string): Promise<number> {
		let [result] = await db
			.select({ count: count() })
			.from(schema.cronJobMonitors)
			.where(eq(schema.cronJobMonitors.teamId, teamId))
			.execute();

		return result?.count ?? 0;
	}

	static async updateById(
		db: Database,
		id: string,
		data: Partial<schema.InsertCronJobMonitor>,
	): Promise<void> {
		await db
			.update(schema.cronJobMonitors)
			.set({ ...data, updatedAt: new Date() })
			.where(eq(schema.cronJobMonitors.id, id));
	}

	static async deleteById(db: Database, id: string): Promise<void> {
		// Delete pings first
		await db.delete(schema.cronJobPings).where(eq(schema.cronJobPings.cronJobMonitorId, id));

		// Then delete the monitor
		await db.delete(schema.cronJobMonitors).where(eq(schema.cronJobMonitors.id, id));
	}

	// Ping handling

	static async recordPing(
		db: Database,
		id: string,
		metadata: { sourceIp?: string; userAgent?: string },
	): Promise<{ wasOnTime: boolean; isRateLimited: boolean }> {
		let monitor = await this.findById(db, id);
		if (!monitor) throw new Error("Cron job monitor not found");

		// Check rate limit: last ping within 1 minute
		if (monitor.lastPingAt) {
			let timeSinceLastPing = Date.now() - monitor.lastPingAt.getTime();
			if (timeSinceLastPing < ONE_MINUTE_MS) {
				return { wasOnTime: false, isRateLimited: true };
			}
		}

		let now = new Date();

		// Determine if ping is on time
		let wasOnTime = true;
		if (monitor.nextExpectedAt) {
			let deadline = new Date(monitor.nextExpectedAt.getTime() + monitor.gracePeriodSeconds * 1000);
			wasOnTime = now <= deadline;
		}

		// Insert ping record
		await db.insert(schema.cronJobPings).values({
			cronJobMonitorId: id,
			wasOnTime,
			sourceIp: metadata.sourceIp,
			userAgent: metadata.userAgent,
		});

		// Calculate next expected time
		let nextExpectedAt = this.calculateNextExpected(monitor.cronExpression, monitor.timezone, now);

		// Update monitor
		await db
			.update(schema.cronJobMonitors)
			.set({
				lastPingAt: now,
				status: "healthy",
				nextExpectedAt,
				updatedAt: now,
			})
			.where(eq(schema.cronJobMonitors.id, id));

		return { wasOnTime, isRateLimited: false };
	}

	// Status checking

	static async getOverdueMonitors(db: Database): Promise<Array<schema.SelectCronJobMonitor>> {
		let now = new Date();

		// Get all enabled monitors that need status checks
		let monitors = await db.query.cronJobMonitors.findMany({
			where(fields, operators) {
				return operators.and(
					operators.isNotNull(fields.enabledAt),
					operators.isNotNull(fields.nextExpectedAt),
					operators.inArray(fields.status, ["healthy", "late"]),
				);
			},
		});

		// Filter in application code for complex grace period logic
		return monitors.filter((monitor) => {
			if (!monitor.nextExpectedAt) return false;

			let missedDeadline = new Date(
				monitor.nextExpectedAt.getTime() + monitor.gracePeriodSeconds * 1000,
			);

			// Missed: past deadline including grace period
			if (now > missedDeadline) return true;

			// Late: past expected time but status is still healthy
			if (monitor.status === "healthy" && now > monitor.nextExpectedAt) return true;

			return false;
		});
	}

	static async updateStatus(db: Database, id: string, status: schema.CronJobStatus): Promise<void> {
		await db
			.update(schema.cronJobMonitors)
			.set({ status, updatedAt: new Date() })
			.where(eq(schema.cronJobMonitors.id, id));
	}

	// Statistics

	static async getStatsById(
		db: Database,
		id: string,
		days = 30,
	): Promise<{
		totalPings: number;
		onTimePings: number;
		latePings: number;
		successRate: number;
	}> {
		let cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

		let { results } = await db.run(sql`
			SELECT
				COUNT(*) AS totalPings,
				SUM(CASE WHEN was_on_time = 1 THEN 1 ELSE 0 END) AS onTimePings,
				SUM(CASE WHEN was_on_time = 0 THEN 1 ELSE 0 END) AS latePings
			FROM cron_job_pings
			WHERE cron_job_monitor_id = ${id}
				AND created_at >= ${cutoff.getTime()}
		`);

		let row = results[0] as
			| { totalPings: number; onTimePings: number; latePings: number }
			| undefined;

		let totalPings = row?.totalPings ?? 0;
		let onTimePings = row?.onTimePings ?? 0;
		let latePings = row?.latePings ?? 0;
		let successRate = totalPings > 0 ? (onTimePings / totalPings) * 100 : 0;

		return { totalPings, onTimePings, latePings, successRate };
	}

	static async getPingsById(
		db: Database,
		id: string,
		limit = 100,
	): Promise<Array<schema.SelectCronJobPing>> {
		return db.query.cronJobPings.findMany({
			where(fields, operators) {
				return operators.eq(fields.cronJobMonitorId, id);
			},
			orderBy(fields, operators) {
				return operators.desc(fields.createdAt);
			},
			limit,
		});
	}

	// Cleanup

	static async cleanPings(db: Database, olderThanDays: number): Promise<number> {
		let cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

		let result = await db
			.delete(schema.cronJobPings)
			.where(lt(schema.cronJobPings.createdAt, cutoff));

		return result.meta.changes;
	}

	// Helpers

	static calculateNextExpected(cronExpression: string, timezone: string, fromDate?: Date): Date {
		let interval = CronExpressionParser.parse(cronExpression, {
			currentDate: fromDate ?? new Date(),
			tz: timezone,
		});

		return interval.next().toDate();
	}

	static isWithinGracePeriod(nextExpected: Date, gracePeriodSeconds: number, now?: Date): boolean {
		let currentTime = now ?? new Date();
		let deadline = new Date(nextExpected.getTime() + gracePeriodSeconds * 1000);
		return currentTime <= deadline;
	}

	static describeCronExpression(cronExpression: string): string {
		// Handle @shortcuts first
		let shortcuts: Record<string, string> = {
			"@yearly": "Every year on January 1st at midnight",
			"@annually": "Every year on January 1st at midnight",
			"@monthly": "Every month on the 1st at midnight",
			"@weekly": "Every Sunday at midnight",
			"@daily": "Every day at midnight",
			"@midnight": "Every day at midnight",
			"@hourly": "Every hour",
		};

		if (shortcuts[cronExpression]) {
			return shortcuts[cronExpression];
		}

		// Parse standard cron expressions
		let parts = cronExpression.trim().split(/\s+/);
		if (parts.length !== 5) {
			return this.getGenericDescription(cronExpression);
		}

		let [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

		// Common patterns
		// Every minute
		if (cronExpression === "* * * * *") {
			return "Every minute";
		}

		// Every hour at specific minute
		if (hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
			if (minute === "0") return "Every hour";
			if (minute === "*") return "Every minute";
			if (/^\d+$/.test(minute!)) return `Every hour at minute ${minute}`;
			if (minute!.includes("/")) {
				let [, interval] = minute!.split("/");
				return `Every ${interval} minutes`;
			}
		}

		// Every day at specific time
		if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
			if (minute === "0" && hour === "0") return "Every day at midnight";
			if (minute === "0" && /^\d+$/.test(hour!)) return `Every day at ${hour}:00`;
			if (/^\d+$/.test(minute!) && /^\d+$/.test(hour!)) {
				return `Every day at ${hour}:${minute!.padStart(2, "0")}`;
			}
		}

		// Weekly patterns
		if (dayOfMonth === "*" && month === "*" && dayOfWeek !== "*") {
			let days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
			let dayName = /^\d$/.test(dayOfWeek!) ? days[Number.parseInt(dayOfWeek!, 10)] : dayOfWeek;

			if (minute === "0" && hour === "0") return `Every ${dayName} at midnight`;
			if (minute === "0" && /^\d+$/.test(hour!)) return `Every ${dayName} at ${hour}:00`;
		}

		// Monthly patterns
		if (dayOfMonth !== "*" && month === "*" && dayOfWeek === "*") {
			if (minute === "0" && hour === "0") {
				return `Monthly on day ${dayOfMonth} at midnight`;
			}
		}

		return this.getGenericDescription(cronExpression);
	}

	private static getGenericDescription(cronExpression: string): string {
		try {
			let interval = CronExpressionParser.parse(cronExpression, { currentDate: new Date() });
			let next = interval.next().toDate();
			return `Scheduled (next: ${next.toISOString()})`;
		} catch {
			return "Custom schedule";
		}
	}
}
