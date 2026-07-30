/**
 * Daily retention job for cron-job ping history: deletes `cron_job_pings` rows older
 * than `PING_RETENTION_DAYS` (365), per `docs/cron-job-monitoring.md`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Job } from "@pkg/jobs";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import { PING_RETENTION_DAYS } from "~/app/data/cron-job";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export class CleanCronJobPingsJob extends Job {
	async perform(): Promise<void> {
		let db = getServiceContainer().get(Database);
		let cutoff = Date.now() - PING_RETENTION_DAYS * MS_PER_DAY;

		let result = await db.exec("DELETE FROM cron_job_pings WHERE created_at < ?", [cutoff]);

		this.logger.info("job.clean_cron_job_pings.completed", {
			rowsDeleted: result.affectedRows ?? 0,
		});
	}
}
