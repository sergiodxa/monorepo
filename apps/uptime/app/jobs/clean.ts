import { BatchedLogger } from "@pkg/logger";
import { env } from "cloudflare:workers";

import database from "~/db/index";
import Monitor from "~/models/monitor";

import type { Job } from "./base";

export default class CleanJob implements Job {
	private db = database(env.DB);
	private logger = new BatchedLogger("job:clean");

	async run(message: Message): Promise<void> {
		try {
			this.logger.info("job.clean.started", { messageId: message.id });

			let result = await Monitor.cleanResults(this.db);

			this.logger.info("job.clean.completed", { rowsDeleted: result.meta.changes });
			return message.ack();
		} catch (error) {
			this.logger.error("job.clean.failed", {
				error: error instanceof Error ? error.message : String(error),
			});
			return message.retry();
		} finally {
			this.logger.flush();
		}
	}
}
