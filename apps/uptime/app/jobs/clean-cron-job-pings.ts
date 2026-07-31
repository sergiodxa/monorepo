/**
 * Daily retention job for cron-job ping history. Two windows, not one (ADR-020):
 *
 * - Rows are kept for `PING_RETENTION_DAYS` (365), because the docs promise a year of
 *   ping history and the monitor detail page reads it.
 * - `source_ip` and `user_agent` are kept for `PING_DETAIL_RETENTION_DAYS` (30) and then
 *   nulled in place, because they answer one question — which caller is misconfigured —
 *   and that question is days old, never a year old. They are also the app's largest
 *   personal-data retention surface, so shortening their window is a privacy improvement
 *   first and a storage one second: a year of retained caller IPs is the kind of thing a
 *   privacy review finds, and unlike a window that turns out too narrow, it cannot be
 *   undone after the fact.
 *
 * Both passes delete or redact in bounded batches, so the first run after this window
 * changed cannot write a year of rows in one invocation.
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
	async perform(): Promise<void> {
		let db = getServiceContainer().get(Database);
		let now = Date.now();

		// Charged when it happens and split by monitors per team, as `CleanJob` explains.
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
