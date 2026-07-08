/**
 * Scheduled maintenance job that purges old `monitor_results` rows. That table now
 * exists only as the "last checked" cache `Monitor.findDue` reads to schedule the next
 * ping — analytics and history live in Analytics Engine — so retention is a plain
 * age cutoff rather than the OLD APP's orphaned-row cleanup (its `completed_at IS
 * NULL` condition targeted a world where this table held full ping history).
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
