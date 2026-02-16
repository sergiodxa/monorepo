import { Job } from "@pkg/jobs";
import { env } from "cloudflare:workers";

import database from "~/db/index";
import CronJobMonitor from "~/models/cron-job-monitor";

export let uptimeMonitorId = "31db20cb-8736-44fa-9ac7-448d2200befd";

export default class CleanCronJobPingsJob extends Job {
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
