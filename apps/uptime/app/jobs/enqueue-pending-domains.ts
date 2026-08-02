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
import { Database } from "remix/data-table";

import TeamDomain from "~/app/data/team-domain";
import { sendQueueBatch } from "~/app/lib/queue";
import { apportionCostByTeam } from "~/app/services/cost";

export class EnqueuePendingDomainsJob extends Job {
	/** The "Enqueue Pending Domains" cron monitor this sweep reports itself to when it completes. */
	static override monitorId = "9a2e4fe3-f5fe-4365-8b8f-2f2d90d6101c";

	async perform(): Promise<void> {
		let db = getServiceContainer().get(Database);
		let pending = await TeamDomain.listUnverified(db);

		if (pending.length === 0) {
			this.logger.info("job.enqueue_pending_domains.none", {});
			return;
		}

		await sendQueueBatch(
			pending.map((domain) => ({ type: "verifyDomainOwnership", teamDomainId: domain.id })),
		);

		/**
		 * The sweep exists because these domains are pending, so its cost belongs to the teams
		 * that own them; a delivery with nothing pending returns above and is platform cost.
		 */
		apportionCostByTeam(pending.map((domain) => domain.team_id));

		this.logger.info("job.enqueue_pending_domains.enqueued", { count: pending.length });
	}
}
