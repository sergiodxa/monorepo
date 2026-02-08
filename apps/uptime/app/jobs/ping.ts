import { BatchedLogger } from "@pkg/logger";
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
		let logger = new BatchedLogger(`job:ping:${this.input.monitorId}`);

		try {
			logger.info("job.ping.started", {
				monitorId: this.input.monitorId,
				ownerId: this.input.ownerId,
				messageId: message.id,
			});

			logger.info("subscription.check", { ownerId: this.input.ownerId });
			let hasActiveSubscription = await Customer.hasActiveSubscription(this.input.ownerId);

			if (!hasActiveSubscription) {
				logger.info("job.ping.skipped", {
					reason: "no_subscription",
				});
				return message.ack();
			}

			logger.info("subscription.verified", { ownerId: this.input.ownerId });

			logger.info("monitor.ping", { monitorId: this.input.monitorId });
			await Monitor.ping(this.db, this.input.monitorId);

			logger.info("job.ping.completed", { status: "success" });
			return message.ack();
		} catch (error) {
			logger.error("job.ping.failed", {
				error: error instanceof Error ? error.message : String(error),
			});
			return message.retry();
		} finally {
			logger.flush();
		}
	}
}
