import { BatchedLogger } from "@pkg/logger";
import { env } from "cloudflare:workers";

import database from "~/db/index";
import TcpMonitor from "~/models/tcp-monitor";
import { checkTcpConnection } from "~/services/check-tcp";

import type { Job } from "./base";

/**
 * Job that checks all enabled TCP monitors.
 * Runs on a schedule to verify TCP port connectivity.
 *
 * Note: TCP monitoring has limitations on Cloudflare Workers free plan.
 * See services/check-tcp.ts for details.
 */
export default class CheckTcpJob implements Job {
	private db = database(env.DB);
	private logger = new BatchedLogger("job:check-tcp");

	async run(message: Message): Promise<void> {
		try {
			let monitors = await TcpMonitor.getEnabledMonitors(this.db);

			this.logger.info("job.check-tcp.started", {
				messageId: message.id,
				monitorCount: monitors.length,
			});

			let successCount = 0;
			let errorCount = 0;

			for (let monitor of monitors) {
				try {
					await this.checkMonitor(monitor);
					successCount++;
				} catch {
					errorCount++;
				}
			}

			this.logger.info("job.check-tcp.completed", {
				monitorCount: monitors.length,
				successCount,
				errorCount,
			});
			return message.ack();
		} catch (error) {
			this.logger.error("job.check-tcp.failed", {
				error: error instanceof Error ? error.message : String(error),
			});
			return message.retry();
		} finally {
			this.logger.flush();
		}
	}

	private async checkMonitor(monitor: {
		id: string;
		name: string;
		host: string;
		port: number;
		timeoutMs: number;
		teamId: string;
		team: { ownerId: string };
	}): Promise<void> {
		this.logger.info("tcp.check", {
			tcpMonitorId: monitor.id,
			host: monitor.host,
			port: monitor.port,
		});
		let result = await checkTcpConnection(monitor.host, monitor.port, monitor.timeoutMs);

		// Map "unsupported" to "down" for storage (since the enum doesn't include "unsupported")
		let storableStatus: "up" | "down" | "timeout" =
			result.status === "unsupported" ? "down" : result.status;

		// Store the result
		this.logger.info("database.insert", {
			table: "tcpMonitorResults",
			tcpMonitorId: monitor.id,
		});
		await TcpMonitor.createResult(this.db, monitor.id, {
			status: storableStatus,
			responseTimeMs: result.responseTimeMs,
			errorMessage: result.errorMessage,
		});

		// Update the monitor's last status
		this.logger.info("database.update", {
			table: "tcpMonitors",
			tcpMonitorId: monitor.id,
			status: storableStatus,
		});
		await TcpMonitor.updateStatus(this.db, monitor.id, storableStatus, result.responseTimeMs);

		this.logger.info("job.check-tcp.monitor-checked", {
			tcpMonitorId: monitor.id,
			status: result.status,
			responseTimeMs: result.responseTimeMs,
		});

		// TODO: Send alerts on status changes (similar to check-ssl.ts)
	}
}
