/**
 * Background job that checks one team domain's DNS TXT record for the ownership
 * token and marks it verified on a match. A DNS-over-HTTPS lookup of
 * `_ping-verification.<hostname>` must return a TXT record whose text is the literal
 * `ping_<teamDomainId>`. A miss or a failed lookup leaves the domain pending for the
 * every-ten-minutes sweep to retry.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { verifyTxtRecord } from "@sdxc/doh";
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";

import TeamDomain from "~/app/data/team-domain";
import jobs from "~/app/jobs";
import { apportionCostByTeam } from "~/app/services/cost";

/**
 * Costs are apportioned to the domain's own team, since verifying it is work that team
 * asked for by adding the domain. A token split into several character-strings still
 * matches, and a name not yet published is a miss; any other lookup failure logs
 * `domains.lookup_failed` without `domain.verified` and leaves the retry to the sweep.
 */
export default createJobHandler(jobs.verifyDomainOwnership, async (ctx) => {
	let domain = await TeamDomain.findById(ctx.database, ctx.input.teamDomainId);
	if (!domain || domain.verified_at !== null) return;

	apportionCostByTeam([domain.team_id]);
	ctx.log.set({ domain: { id: domain.id }, team: { id: domain.team_id } });

	let verified = await verifyTxtRecord(
		`_ping-verification.${domain.hostname}`,
		`ping_${domain.id}`,
	);
	if (isFailure(verified)) {
		ctx.log.warn("domains.lookup_failed", { error: verified.error.message });
		return;
	}

	if (verified.data) await TeamDomain.markVerified(ctx.database, domain.id);
	ctx.log.set({ domain: { verified: verified.data } });
});
