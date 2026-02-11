import { BatchedLogger } from "@pkg/logger";
import { env } from "cloudflare:workers";

import database from "~/db/index";
import { pingUptime } from "~/lib/ping-uptime";
import CronJobMonitor from "~/models/cron-job-monitor";

import type { Job } from "./base";

export default class CleanCronJobPingsJob implements Job {
	private db = database(env.DB);
	private logger = new BatchedLogger("job:clean-cron-job-pings");

	async run(message: Message): Promise<void> {
		try {
			this.logger.info("job.clean-cron-job-pings.started", { messageId: message.id });

			// Ping uptime monitor
			await pingUptime("31db20cb-8736-44fa-9ac7-448d2200befd", env.UPTIME_CRON_API_KEY);

			this.logger.info("database.delete", {
				table: "cronJobPings",
				operation: "clean_old_pings",
			});
			let deleted = await CronJobMonitor.cleanPings(this.db, 365);

			this.logger.info("job.clean-cron-job-pings.completed", { rowsDeleted: deleted });
			return message.ack();
		} catch (error) {
			this.logger.error("job.clean-cron-job-pings.failed", {
				error: error instanceof Error ? error.message : String(error),
			});
			return message.retry();
		} finally {
			this.logger.flush();
		}
	}
}
