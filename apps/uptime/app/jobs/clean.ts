import { logger } from "@pkg/logger";
import { env } from "cloudflare:workers";

import database from "~/db/index";
import Monitor from "~/models/monitor";

import type { Job } from "./base";

export default class CleanJob implements Job {
	private db = database(env.DB);

	async run(message: Message): Promise<void> {
		let result = await Monitor.cleanResults(this.db);
		logger.info("clean.completed", { rowsDeleted: result.meta.changes });
		return message.ack();
	}
}
