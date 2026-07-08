/**
 * Background job that sweeps every enabled TCP monitor once per run (a fixed 5-minute
 * cadence — TCP monitors are not staggered by their individual `interval_seconds`,
 * matching how `CheckDnsJob` treats DNS monitors). Attempts a raw TCP connection to
 * each host:port and records the outcome via `TcpMonitor.recordCheckResult`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Job } from "@pkg/jobs";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import TcpMonitor from "~/app/data/tcp-monitor";
import { checkTcpConnection } from "~/app/services/tcp-check";

export class CheckTcpJob extends Job {
	async perform(): Promise<void> {
		let db = getServiceContainer().get(Database);
		let monitors = await TcpMonitor.listEnabled(db);

		let successCount = 0;
		let errorCount = 0;

		for (let monitor of monitors) {
			try {
				let result = await checkTcpConnection(monitor.host, monitor.port, monitor.timeout_ms);
				await TcpMonitor.recordCheckResult(db, monitor.id, result);
				successCount++;
			} catch (error) {
				errorCount++;
				this.logger.error("job.check_tcp.monitor_failed", {
					monitorId: monitor.id,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		this.logger.info("job.check_tcp.completed", {
			total: monitors.length,
			successCount,
			errorCount,
		});
	}
}
