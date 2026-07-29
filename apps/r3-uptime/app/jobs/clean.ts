/**
 * Scheduled maintenance job that purges old `monitor_results` rows. That table exists
 * as the "last checked" cache `Monitor.findDue` reads to schedule the next ping, plus
 * the record of the last day or two of checks that `Monitor.countConsumedPingsByTeam`
 * counts before the daily rollup reaches them — long-term analytics and history live
 * in Analytics Engine — so retention is a plain age cutoff, kept comfortably longer
 * than that counting window. A row whose `completed_at` is still `NULL` (an in-flight
 * or pending check) is never matched by the cutoff and is left alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Job } from "@pkg/jobs";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export class CleanJob extends Job {
	async perform(): Promise<void> {
		let db = getServiceContainer().get(Database);
		let cutoff = Date.now() - RETENTION_MS;

		let result = await db.exec("DELETE FROM monitor_results WHERE completed_at < ?", [cutoff]);

		this.logger.info("job.clean.completed", { rowsDeleted: result.affectedRows ?? 0 });
	}
}
