/**
 * Daily retention job for cron-job ping history (ADR-020). Ping rows are kept for
 * `PING_RETENTION_DAYS` since the docs and monitor detail page depend on a year of
 * history, while `source_ip` and `user_agent` are redacted sooner because they only
 * answer a days-old debugging question and are the app's largest personal-data
 * surface. Both passes run in bounded batches so a widened window cannot flood one run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Job } from "@pkg/jobs";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import { PING_RETENTION_DAYS } from "~/app/data/cron-job";
import Team from "~/app/data/team";
import { deleteOlderThan, redactOlderThan } from "~/app/lib/retention";
import { apportionCost } from "~/app/services/cost";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * How long a ping keeps the request details it was recorded with, before they are nulled
 * and only the timing is kept. Widening this only stops future redaction — it cannot
 * bring back details already cleared.
 */
const PING_DETAIL_RETENTION_DAYS = 30;

/** Columns cleared once a ping passes {@link PING_DETAIL_RETENTION_DAYS}. */
const PING_DETAIL_COLUMNS = ["source_ip", "user_agent"];

export class CleanCronJobPingsJob extends Job {
	/** The "Clean Old Cron Job Pings" cron monitor this sweep reports itself to when it completes. */
	static override monitorId = "31db20cb-8736-44fa-9ac7-448d2200befd";

	/** Charges the apportioned per-team monitor count at run time, since cost is billed when the sweep happens rather than accrued continuously. */
	async perform(): Promise<void> {
		let db = getServiceContainer().get(Database);
		let now = Date.now();

		apportionCost(await Team.countMonitorsByTeam(db));

		let deleted = await deleteOlderThan(
			db,
			"cron_job_pings",
			"created_at",
			now - PING_RETENTION_DAYS * MS_PER_DAY,
		);

		let redacted = await redactOlderThan(
			db,
			"cron_job_pings",
			"created_at",
			PING_DETAIL_COLUMNS,
			now - PING_DETAIL_RETENTION_DAYS * MS_PER_DAY,
		);

		this.logger.info("job.clean_cron_job_pings.completed", {
			rowsDeleted: deleted.rowsAffected,
			rowsRedacted: redacted.rowsAffected,
			batches: deleted.batches + redacted.batches,
			reachedCeiling: deleted.reachedCeiling || redacted.reachedCeiling,
		});
	}
}
