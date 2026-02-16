import { Job } from "@pkg/jobs";
import { env } from "cloudflare:workers";

import database from "~/db/index";
import Monitor from "~/models/monitor";

export let uptimeMonitorId = "80294988-476e-4e99-9f5c-abfeb369316a";

export default class CleanJob extends Job {
	async perform(): Promise<void> {
		let db = database(env.DB);

		this.logger.info("database.delete", {
			table: "monitorResults",
			operation: "clean_old_results",
		});

		let result = await Monitor.cleanResults(db);

		this.logger.info("job.clean.completed", { rowsDeleted: result.meta.changes });
	}
}
