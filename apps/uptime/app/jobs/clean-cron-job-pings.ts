/**
 * Scheduled maintenance job that prunes cron job ping records older than 365 days
 * by delegating to `CronJobMonitor.cleanPings`, then logs how many rows it removed.
 * It exists to cap unbounded growth of the cron ping history table and keep the
 * database lean over time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Job } from "@pkg/jobs";
import { env } from "cloudflare:workers";

import database from "~/db/index";
import CronJobMonitor from "~/models/cron-job-monitor";

export class CleanCronJobPingsJob extends Job {
	static override monitorId = "31db20cb-8736-44fa-9ac7-448d2200befd";

	async perform(): Promise<void> {
		let db = database(env.DB);

		this.logger.info("database.delete", {
			table: "cronJobPings",
			operation: "clean_old_pings",
		});

		let deleted = await CronJobMonitor.cleanPings(db, 365);

		this.logger.info("job.clean-cron-job-pings.completed", { rowsDeleted: deleted });
	}
}
