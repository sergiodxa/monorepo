/**
 * Background job that finds every team domain not yet verified and re-enqueues a
 * `verifyDomainOwnership` message for each, batched into one queue call. Runs every
 * 10 minutes so a domain the user just added — or one whose DNS record propagation
 * is still catching up — keeps getting retried without the user doing anything.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createJobHandler } from "@pkg/jobs";

import TeamDomain from "~/app/data/team-domain";
import jobs from "~/app/jobs";
import { enqueueMany } from "~/app/lib/queue";
import { apportionCostByTeam } from "~/app/services/cost";

export default createJobHandler(jobs.enqueuePendingDomains, async (ctx) => {
	let pending = await TeamDomain.listUnverified(ctx.database);

	if (pending.length === 0) {
		ctx.logger.info("job.enqueue_pending_domains.none", {});
		return;
	}

	await enqueueMany(
		jobs.verifyDomainOwnership,
		pending.map((domain) => ({ teamDomainId: domain.id })),
	);

	/**
	 * The sweep exists because these domains are pending, so its cost belongs to the teams
	 * that own them; a delivery with nothing pending returns above and is platform cost.
	 */
	apportionCostByTeam(pending.map((domain) => domain.team_id));

	ctx.logger.info("job.enqueue_pending_domains.enqueued", { count: pending.length });
});
