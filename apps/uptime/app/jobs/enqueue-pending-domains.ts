import { BatchedLogger } from "@pkg/logger";
import { env, waitUntil } from "cloudflare:workers";

import database from "~/db/index";
import { pingUptime } from "~/lib/ping-uptime";

import type { Job } from "./base";

export default class EnqueuePendingDomainsJob implements Job {
	private db = database(env.DB);
	private logger = new BatchedLogger("job:enqueue-pending-domains");

	async run(message: Message): Promise<void> {
		try {
			this.logger.info("job.enqueue-pending-domains.started", { messageId: message.id });

			this.logger.info("database.query", {
				table: "teamDomains",
				operation: "select",
				filter: "verifiedAt=null",
			});
			let teamDomains = await this.db.query.teamDomains.findMany({
				where(fields, operators) {
					return operators.isNull(fields.verifiedAt);
				},
			});

			this.logger.info("database.query.complete", { count: teamDomains.length });

			if (teamDomains.length === 0) {
				this.logger.info("job.enqueue-pending-domains.skipped", {
					reason: "no_pending_domains",
				});
				await pingUptime("9a2e4fe3-f5fe-4365-8b8f-2f2d90d6101c", env.UPTIME_CRON_API_KEY);
				return message.ack();
			}

			this.logger.info("queue.send-batch", {
				queue: "QUEUE",
				messageType: "verifyDomainOwnership",
				count: teamDomains.length,
			});
			waitUntil(
				env.QUEUE.sendBatch(
					teamDomains.map((teamDomain) => {
						return {
							body: {
								type: "verifyDomainOwnership",
								teamDomainId: teamDomain.id,
							},
							contentType: "json",
						};
					}),
				),
			);

			this.logger.info("job.enqueue-pending-domains.completed", {
				domainsEnqueued: teamDomains.length,
			});

			await pingUptime("9a2e4fe3-f5fe-4365-8b8f-2f2d90d6101c", env.UPTIME_CRON_API_KEY);
			return message.ack();
		} catch (error) {
			this.logger.error("job.enqueue-pending-domains.failed", {
				error: error instanceof Error ? error.message : String(error),
			});
			return message.retry();
		} finally {
			this.logger.flush();
		}
	}
}
