/**
 * Background job that checks one team domain's DNS TXT record for the ownership
 * token and marks it verified on a match. A DNS-over-HTTPS lookup of
 * `_ping-verification.<hostname>` must return a TXT record whose value is
 * the literal string `ping_<teamDomainId>` (the DNS-JSON API returns TXT record
 * content JSON-quoted, hence comparing against `JSON.stringify(...)`). A miss leaves
 * the domain pending for the every-ten-minutes sweep to retry.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createJobHandler } from "@sdxc/jobs";
import * as s from "remix/data-schema";

import TeamDomain from "~/app/data/team-domain";
import jobs from "~/app/jobs";
import { apportionCostByTeam } from "~/app/services/cost";

const DnsAnswerSchema = s.object({
	Answer: s.optional(
		s.array(
			s.object({
				name: s.string(),
				type: s.number(),
				TTL: s.number(),
				data: s.string(),
			}),
		),
	),
});

/**
 * Costs are apportioned to the domain's own team, since verifying it is work that team
 * asked for by adding the domain.
 */
export default createJobHandler(jobs.verifyDomainOwnership, async (ctx) => {
	let domain = await TeamDomain.findById(ctx.database, ctx.input.teamDomainId);
	if (!domain || domain.verified_at !== null) return;

	apportionCostByTeam([domain.team_id]);
	ctx.log.set({ domain: { id: domain.id }, team: { id: domain.team_id } });

	let url = new URL("https://cloudflare-dns.com/dns-query");
	url.searchParams.set("name", `_ping-verification.${domain.hostname}`);
	url.searchParams.set("type", "TXT");

	try {
		let response = await fetch(url, { headers: { Accept: "application/dns-json" } });
		let body = s.parse(DnsAnswerSchema, await response.json());
		let expected = JSON.stringify(`ping_${domain.id}`);
		let verified = (body.Answer ?? []).some((record) => record.data === expected);

		if (verified) await TeamDomain.markVerified(ctx.database, domain.id);

		ctx.log.set({ domain: { verified } });
	} catch (error) {
		ctx.log.warn("domains.lookup_failed", {
			error: error instanceof Error ? error.message : String(error),
		});
	}
});
