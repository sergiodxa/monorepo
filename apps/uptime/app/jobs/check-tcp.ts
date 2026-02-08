import { logger } from "@pkg/logger";
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

	async run(message: Message): Promise<void> {
		try {
			let monitors = await TcpMonitor.getEnabledMonitors(this.db);

			logger.info("check-tcp.started", { monitorCount: monitors.length });

			for (let monitor of monitors) {
				await this.checkMonitor(monitor);
			}

			logger.info("check-tcp.completed", { monitorCount: monitors.length });
			return message.ack();
		} catch (error) {
			logger.error("check-tcp.failed", {
				error: error instanceof Error ? error.message : String(error),
			});
			return message.retry();
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
		try {
			let result = await checkTcpConnection(monitor.host, monitor.port, monitor.timeoutMs);

			// Map "unsupported" to "down" for storage (since the enum doesn't include "unsupported")
			let storableStatus: "up" | "down" | "timeout" =
				result.status === "unsupported" ? "down" : result.status;

			// Store the result
			await TcpMonitor.createResult(this.db, monitor.id, {
				status: storableStatus,
				responseTimeMs: result.responseTimeMs,
				errorMessage: result.errorMessage,
			});

			// Update the monitor's last status
			await TcpMonitor.updateStatus(this.db, monitor.id, storableStatus, result.responseTimeMs);

			logger.info("check-tcp.monitor-checked", {
				tcpMonitorId: monitor.id,
				monitorName: monitor.name,
				host: monitor.host,
				port: monitor.port,
				status: result.status,
				responseTimeMs: result.responseTimeMs,
			});

			// TODO: Send alerts on status changes (similar to check-ssl.ts)
		} catch (error) {
			logger.error("check-tcp.monitor-check-failed", {
				tcpMonitorId: monitor.id,
				monitorName: monitor.name,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
}
