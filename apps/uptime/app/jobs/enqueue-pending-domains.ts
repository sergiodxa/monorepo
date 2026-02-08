import { BatchedLogger } from "@pkg/logger";
import { env, waitUntil } from "cloudflare:workers";

import database from "~/db/index";

import type { Job } from "./base";

export default class EnqueuePendingDomainsJob implements Job {
	private db = database(env.DB);
	private logger = new BatchedLogger("job:enqueue-pending-domains");

	async run(message: Message): Promise<void> {
		try {
			this.logger.info("job.enqueue-pending-domains.started", { messageId: message.id });

			let teamDomains = await this.db.query.teamDomains.findMany({
				where(fields, operators) {
					return operators.isNull(fields.verifiedAt);
				},
			});

			if (teamDomains.length === 0) {
				this.logger.info("job.enqueue-pending-domains.skipped", {
					reason: "no_pending_domains",
				});
				return message.ack();
			}

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
