import { logger } from "@pkg/logger";
import { env, waitUntil } from "cloudflare:workers";

import database from "~/db/index";

import type { Job } from "./base";

export default class EnqueuePendingDomainsJob implements Job {
	private db = database(env.DB);

	async run(message: Message): Promise<void> {
		let teamDomains = await this.db.query.teamDomains.findMany({
			where(fields, operators) {
				return operators.isNull(fields.verifiedAt);
			},
		});

		if (teamDomains.length === 0) {
			logger.info("enqueue-pending-domains.skipped", {
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

		logger.info("enqueue-pending-domains.completed", {
			domainsEnqueued: teamDomains.length,
		});

		return message.ack();
	}
}
