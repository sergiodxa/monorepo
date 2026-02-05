import { logger } from "@pkg/logger";
import { env } from "cloudflare:workers";

import type { SelectMonitor, SelectTeam } from "~/db/schema";

import database from "~/db/index";
import Customer from "~/models/customer";
import Monitor from "~/models/monitor";

import type { Job } from "./base";

export default class PingJob implements Job {
	private db = database(env.DB);

	constructor(
		private input: {
			monitorId: SelectMonitor["id"];
			ownerId: SelectTeam["ownerId"];
		},
	) {}

	async run(message: Message): Promise<void> {
		let hasActiveSubscription = await Customer.hasActiveSubscription(this.input.ownerId);

		if (!hasActiveSubscription) {
			logger.info("ping.skipped_no_subscription", {
				monitorId: this.input.monitorId,
				ownerId: this.input.ownerId,
			});
			return message.ack();
		}

		try {
			await Monitor.ping(this.db, this.input.monitorId);
			logger.info("ping.success", { monitorId: this.input.monitorId });
			return message.ack();
		} catch (error) {
			logger.error("ping.failed", {
				monitorId: this.input.monitorId,
				error: error instanceof Error ? error.message : String(error),
			});
			return message.retry();
		}
	}
}
