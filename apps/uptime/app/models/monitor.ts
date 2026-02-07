import { env, waitUntil } from "cloudflare:workers";
import {
	addSeconds,
	differenceInSeconds,
	endOfDay,
	endOfMonth,
	isAfter,
	startOfDay,
	startOfMonth,
} from "date-fns";
import { and, count, eq, gte, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "~/db/index";

import * as schema from "~/db/schema";

const MILLISECONDS_PER_SECOND = 1000;
const SEVEN_DAYS = 7 * 24 * 60 * 60 * MILLISECONDS_PER_SECOND;

export default class Monitor {
	static async create(
		db: Database,
		authorId: string,
		teamId: string,
		input: {
			name: string;
			url: string;
			method: schema.InsertMonitor["method"];
			status: number;
			interval: number;
			timeout: number;
		},
	) {
		let [monitor] = await db
			.insert(schema.monitors)
			.values({ authorId, teamId, ...input })
			.returning();

		if (monitor) return monitor;
		throw new Error("Failed to create monitor");
	}

	static async listByTeam(db: Database, teamId: string) {
		let monitors = await db.query.monitors.findMany({
			where(fields, operators) {
				return operators.eq(fields.teamId, teamId);
			},

			orderBy(fields, operators) {
				return operators.desc(fields.createdAt);
			},
		});

		let whenResults = monitors.map((monitor) => {
			return db.query.monitorResults.findMany({
				where(fields, operators) {
					return operators.and(
						operators.eq(fields.monitorId, monitor.id),
						operators.isNotNull(fields.completedAt),
						operators.isNotNull(fields.responseStatus),
						operators.isNotNull(fields.responseTimeMs),
					);
				},
				orderBy(fields, operators) {
					return operators.asc(fields.createdAt);
				},
			});
		});

		return monitors.map((monitor, index) => {
			let whenResult = whenResults[index];
			if (!whenResult) return { ...monitor, results: Promise.resolve([]) };
			return { ...monitor, results: whenResult };
		});
	}

	static async countByTeam(db: Database, teamId: string) {
		let [result] = await db
			.select({ count: count() })
			.from(schema.monitors)
			.where(eq(schema.monitors.teamId, teamId))
			.execute();
		if (result) return result.count;
		return 0;
	}

	static async ping(db: Database, monitorId: string) {
		let monitor = await db.query.monitors.findFirst({
			where(fields, operators) {
				return operators.eq(fields.id, monitorId);
			},
		});

		if (!monitor) throw new Error("Monitor not found");

		let [monitorResult] = await db.insert(schema.monitorResults).values({ monitorId }).returning();

		if (!monitorResult) {
			throw new Error("Failed to create monitor result");
		}

		let workflow = await env.PING.create({ id: monitorResult.id });
		return { monitor, monitorResult, workflow };
	}

	static async pingLater(db: Database, scheduledDate: Date) {
		let monitors = await db.query.monitors.findMany({
			columns: { id: true, intervalSeconds: true },
			where(fields, operators) {
				return operators.isNotNull(fields.enabledAt);
			},
			with: {
				team: {
					columns: { ownerId: true },
				},
				results: {
					limit: 1,
					columns: { completedAt: true },
					where(fields, operators) {
						return operators.lt(fields.completedAt, scheduledDate);
					},
					orderBy(fields, operators) {
						return operators.desc(fields.completedAt);
					},
				},
			},
		});

		let messages: MessageSendRequest<{
			type: "ping";
			payload: { monitorId: string; ownerId: string };
		}>[] = monitors
			.filter((monitor) => {
				let lastResult = monitor.results[0];

				// If no results, monitor has never been run
				if (!lastResult) return true;

				// If last result is not completed, monitor is still running
				if (lastResult.completedAt === null) return false;

				let nextRun = addSeconds(lastResult.completedAt, monitor.intervalSeconds);

				return isAfter(scheduledDate, nextRun);
			})
			.map((monitor) => {
				return {
					body: {
						type: "ping",
						payload: { monitorId: monitor.id, ownerId: monitor.team.ownerId },
					},
					contentType: "json",
				};
			});

		if (messages.length === 0) return;
		waitUntil(env.QUEUE.sendBatch(messages));
	}

	static async updateById(
		db: Database,
		monitorId: string,
		input: Partial<{
			name: string;
			url: string;
			method: schema.InsertMonitor["method"];
			expectedStatus: number;
			intervalSeconds: number;
			locationHint: schema.InsertMonitor["locationHint"];
		}>,
	) {
		let [monitor] = await db
			.update(schema.monitors)
			.set(input)
			.where(eq(schema.monitors.id, monitorId))
			.returning();

		if (monitor) return monitor;
		throw new Error(`Failed to update monitor ${monitorId}`);
	}

	static async deleteById(db: Database, monitorId: string) {
		let monitor = await db.query.monitors.findFirst({
			columns: { name: true },
			where(fields, operators) {
				return operators.eq(fields.id, monitorId);
			},
		});

		let result = await db.delete(schema.monitors).where(eq(schema.monitors.id, monitorId));

		if (result.success) return { deleted: true, monitor };
		throw new Error(`Failed to delete monitor ${monitorId}`);
	}

	static async cleanResults(db: Database) {
		return db
			.delete(schema.monitorResults)
			.where(
				and(
					isNull(schema.monitorResults.completedAt),
					gte(schema.monitorResults.createdAt, new Date(Date.now() - SEVEN_DAYS)),
				),
			)
			.execute();
	}

	static async getMonitorsByTeamId(db: Database, teamId: string) {
		return await db.query.monitors.findMany({
			where(fields, operators) {
				return operators.eq(fields.teamId, teamId);
			},
			orderBy(fields, operators) {
				return operators.desc(fields.createdAt);
			},
		});
	}

	static async getStatsById(db: Database, monitorId: string) {
		let [{ results }, p99Rows] = await Promise.all([
			db.run(sql`
SELECT
  COUNT(*) AS total,
  SUM(CASE WHEN r.response_status = m.expected_status THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS uptime,
  MAX(r.completed_at) AS lastCheck
FROM monitor_results r
JOIN monitors m ON r.monitor_id = m.id
WHERE r.monitor_id = ${monitorId} AND r.completed_at IS NOT NULL AND r.response_status IS NOT NULL`),

			db.query.monitorResults.findMany({
				columns: { responseTimeMs: true },
				where(fields, operators) {
					return operators.and(
						operators.eq(fields.monitorId, monitorId),
						operators.isNotNull(fields.responseTimeMs),
					);
				},
				orderBy(fields, operators) {
					return operators.asc(fields.responseTimeMs);
				},
			}),
		]);

		let responseTimes = p99Rows.map((r) => r.responseTimeMs).filter(Boolean);
		let p99Index = Math.floor(responseTimes.length * 0.99);

		let [result] = z
			.tuple([
				z.object({
					total: z.number().int(),
					uptime: z.number().min(0).max(100).nullable(),
					lastCheck: z
						.number()
						.transform((val) => new Date(val))
						.nullable(),
				}),
			])
			.parse(results);

		return {
			...result,
			p99: responseTimes[p99Index] ?? null,
		};
	}

	static async getStatsByTeamId(db: Database, teamId: string) {
		let [{ results }, p99Rows] = await Promise.all([
			db.run(sql`
SELECT
  COUNT(*) AS total,
  SUM(CASE WHEN r.response_status = m.expected_status THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS uptime,
  MAX(r.completed_at) AS lastCheck
FROM monitor_results r
JOIN monitors m ON r.monitor_id = m.id
WHERE r.completed_at IS NOT NULL AND r.response_status IS NOT NULL AND m.team_id = ${teamId}`),

			db.query.monitorResults.findMany({
				columns: { responseTimeMs: true },
				where(fields, operators) {
					return operators.isNotNull(fields.responseTimeMs);
				},
				orderBy(fields, operators) {
					return operators.asc(fields.responseTimeMs);
				},
			}),
		]);

		let responseTimes = p99Rows.map((r) => r.responseTimeMs).filter(Boolean);
		let p99Index = Math.floor(responseTimes.length * 0.99);

		let [result] = z
			.tuple([
				z.object({
					total: z.number().int(),
					uptime: z.number().min(0).max(100).nullable(),
					lastCheck: z
						.number()
						.transform((val) => new Date(val))
						.nullable(),
				}),
			])
			.parse(results);

		return {
			...result,
			p99: responseTimes[p99Index] ?? null,
		};
	}

	static async getResultsById(db: Database, monitorId: string) {
		let { results } = await db.run(sql`
        SELECT
          DATE(r.completed_at / 1000, 'unixepoch') AS date,
          COUNT(*) AS total,
          ROUND(SUM(CASE WHEN r.response_status = m.expected_status THEN 1 ELSE 0 END) * 1.0 / COUNT(*), 2) AS successRate
        FROM monitor_results r
        JOIN monitors m ON r.monitor_id = m.id
        WHERE r.monitor_id = ${monitorId} AND r.completed_at IS NOT NULL
        GROUP BY date
        ORDER BY date ASC
    `);

		return z
			.object({
				date: z.string(),
				total: z.number(),
				successRate: z.number(),
			})
			.array()
			.parse(results);
	}

	static async getResultsByTeam(db: Database, teamId: string) {
		let { results } = await db.run(sql`
      SELECT
        DATE(r.completed_at / 1000, 'unixepoch') AS date,
        COUNT(*) AS total,
        ROUND(SUM(CASE WHEN r.response_status = m.expected_status THEN 1 ELSE 0 END) * 1.0 / COUNT(*), 2) AS successRate
      FROM monitor_results r
      JOIN monitors m ON r.monitor_id = m.id
      WHERE r.completed_at IS NOT NULL AND m.team_id = ${teamId}
      GROUP BY date
      ORDER BY date ASC
  `);

		return z
			.object({
				date: z.string(),
				total: z.number(),
				successRate: z.number(),
			})
			.array()
			.parse(results);
	}

	static async estimateConsumedPingsByTeam(db: Database, teamId: string, date: Date) {
		let monitors = await db.query.monitors.findMany({
			columns: { intervalSeconds: true },
			where(fields, operators) {
				return operators.and(
					operators.eq(fields.teamId, teamId),
					operators.isNotNull(fields.enabledAt),
				);
			},
		});

		let start = startOfMonth(startOfDay(date));
		let end = endOfMonth(endOfDay(date));
		let diff = differenceInSeconds(end, start);

		if (monitors.length === 0) return 0;

		return monitors.map((m) => diff / m.intervalSeconds).reduce((a, b) => a + b);
	}

	static async estimateConsumedPingsByMonitor(db: Database, monitorId: string, date: Date) {
		let monitor = await db.query.monitors.findFirst({
			columns: { intervalSeconds: true },
			where(fields, operators) {
				return operators.eq(fields.id, monitorId);
			},
		});

		if (!monitor) return 0;

		let start = startOfMonth(startOfDay(date));
		let end = endOfMonth(endOfDay(date));
		let diff = differenceInSeconds(end, start);

		return diff / monitor.intervalSeconds;
	}
}
