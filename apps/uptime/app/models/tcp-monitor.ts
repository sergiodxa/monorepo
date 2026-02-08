import { eq } from "drizzle-orm";

import type { Database } from "~/db/index";

import * as schema from "~/db/schema";

export default class TcpMonitor {
	static async create(
		db: Database,
		teamId: string,
		input: {
			name: string;
			host: string;
			port: number;
			timeoutMs?: number;
			intervalSeconds?: number;
		},
	) {
		let [tcpMonitor] = await db
			.insert(schema.tcpMonitors)
			.values({
				teamId,
				name: input.name,
				host: input.host,
				port: input.port,
				timeoutMs: input.timeoutMs ?? 5000,
				intervalSeconds: input.intervalSeconds ?? 60,
			})
			.returning();

		if (tcpMonitor) return tcpMonitor;
		throw new Error("Failed to create TCP monitor");
	}

	static async listByTeam(db: Database, teamId: string) {
		return db.query.tcpMonitors.findMany({
			where(fields, operators) {
				return operators.eq(fields.teamId, teamId);
			},
			orderBy(fields, operators) {
				return operators.desc(fields.createdAt);
			},
		});
	}

	static async findById(db: Database, tcpMonitorId: string) {
		return db.query.tcpMonitors.findFirst({
			where(fields, operators) {
				return operators.eq(fields.id, tcpMonitorId);
			},
		});
	}

	static async findByIdAndTeam(db: Database, tcpMonitorId: string, teamId: string) {
		return db.query.tcpMonitors.findFirst({
			where(fields, operators) {
				return operators.and(
					operators.eq(fields.id, tcpMonitorId),
					operators.eq(fields.teamId, teamId),
				);
			},
		});
	}

	static async updateById(
		db: Database,
		tcpMonitorId: string,
		input: Partial<{
			name: string;
			host: string;
			port: number;
			timeoutMs: number;
			intervalSeconds: number;
			isEnabled: boolean;
		}>,
	) {
		let [tcpMonitor] = await db
			.update(schema.tcpMonitors)
			.set(input)
			.where(eq(schema.tcpMonitors.id, tcpMonitorId))
			.returning();

		if (tcpMonitor) return tcpMonitor;
		throw new Error(`Failed to update TCP monitor ${tcpMonitorId}`);
	}

	static async deleteById(db: Database, tcpMonitorId: string) {
		// Delete results first
		await db
			.delete(schema.tcpMonitorResults)
			.where(eq(schema.tcpMonitorResults.tcpMonitorId, tcpMonitorId));

		// Then delete the monitor
		let result = await db.delete(schema.tcpMonitors).where(eq(schema.tcpMonitors.id, tcpMonitorId));

		if (result.success) return { deleted: true };
		throw new Error(`Failed to delete TCP monitor ${tcpMonitorId}`);
	}

	static async updateStatus(
		db: Database,
		tcpMonitorId: string,
		status: "up" | "down" | "timeout",
		responseTimeMs: number | null,
	) {
		await db
			.update(schema.tcpMonitors)
			.set({
				lastCheckedAt: new Date(),
				lastStatus: status,
				lastResponseTimeMs: responseTimeMs,
			})
			.where(eq(schema.tcpMonitors.id, tcpMonitorId));
	}

	static async createResult(
		db: Database,
		tcpMonitorId: string,
		result: {
			status: "up" | "down" | "timeout";
			responseTimeMs: number | null;
			errorMessage: string | null;
		},
	) {
		let [tcpMonitorResult] = await db
			.insert(schema.tcpMonitorResults)
			.values({
				tcpMonitorId,
				status: result.status,
				responseTimeMs: result.responseTimeMs,
				errorMessage: result.errorMessage,
				checkedAt: new Date(),
			})
			.returning();

		if (tcpMonitorResult) return tcpMonitorResult;
		throw new Error("Failed to create TCP monitor result");
	}

	static async getResultsByMonitorId(db: Database, tcpMonitorId: string, limit = 100) {
		return db.query.tcpMonitorResults.findMany({
			where(fields, operators) {
				return operators.eq(fields.tcpMonitorId, tcpMonitorId);
			},
			orderBy(fields, operators) {
				return operators.desc(fields.checkedAt);
			},
			limit,
		});
	}

	static async getEnabledMonitors(db: Database) {
		return db.query.tcpMonitors.findMany({
			where(fields, operators) {
				return operators.eq(fields.isEnabled, true);
			},
			with: {
				team: {
					columns: { ownerId: true },
				},
			},
		});
	}
}
