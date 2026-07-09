/**
 * Background job that finds every team domain not yet verified and re-enqueues a
 * `verifyDomainOwnership` message for each, batched into one queue call. Runs every
 * 10 minutes so a domain the user just added — or one whose DNS record propagation
 * is still catching up — keeps getting retried without the user doing anything.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Job } from "@pkg/jobs";
import { getServiceContainer } from "@pkg/service-container";
import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";

import TeamDomain from "~/app/data/team-domain";

export class EnqueuePendingDomainsJob extends Job {
	async perform(): Promise<void> {
		let db = getServiceContainer().get(Database);
		let pending = await TeamDomain.listUnverified(db);

		if (pending.length === 0) {
			this.logger.info("job.enqueue_pending_domains.none", {});
			return;
		}

		await env.QUEUE.sendBatch(
			pending.map((domain) => ({
				body: { type: "verifyDomainOwnership", teamDomainId: domain.id },
				contentType: "json",
			})),
		);

		this.logger.info("job.enqueue_pending_domains.enqueued", { count: pending.length });
	}
}
