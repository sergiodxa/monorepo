import { Job } from "@pkg/jobs";
import { env, waitUntil } from "cloudflare:workers";

import database from "~/db/index";

export let uptimeMonitorId = "9a2e4fe3-f5fe-4365-8b8f-2f2d90d6101c";

export default class EnqueuePendingDomainsJob extends Job {
	async perform(): Promise<void> {
		let db = database(env.DB);

		this.logger.info("database.query", {
			table: "teamDomains",
			operation: "select",
			filter: "verifiedAt=null",
		});

		let teamDomains = await db.query.teamDomains.findMany({
			where(fields, operators) {
				return operators.isNull(fields.verifiedAt);
			},
		});

		this.logger.info("database.query.complete", { count: teamDomains.length });

		if (teamDomains.length === 0) {
			this.logger.info("job.enqueue-pending-domains.skipped", {
				reason: "no_pending_domains",
			});
			return;
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
	}
}
