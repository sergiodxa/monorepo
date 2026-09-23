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

import type { Result } from "@sdxc/result";

import { createJobHandler } from "@sdxc/jobs";
import { failure, isFailure, success, wrap } from "@sdxc/result";
import * as s from "remix/data-schema";

import TeamDomain from "~/app/data/team-domain";
import jobs from "~/app/jobs";
import { readCharacterStrings } from "~/app/lib/dns-record-value";
import { apportionCostByTeam } from "~/app/services/cost";

const DOH_URL = "https://cloudflare-dns.com/dns-query";

const TXT_TYPE_CODE = 16;

/** `NXDOMAIN`: the verification name does not exist yet, a definitive miss. */
const NXDOMAIN = 3;

const DnsResponseSchema = s.object({
	Status: s.number(),
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
 * Resolves the TXT records at `name` into their texts, each record's character-strings
 * rejoined so a value published in several chunks compares whole. `NXDOMAIN` is an empty
 * answer; an HTTP error or any other DNS status is a failure, since it says nothing about
 * whether the token is published.
 */
async function lookupTxtRecords(name: string): Promise<Result<string[], Error>> {
	let url = new URL(DOH_URL);
	url.searchParams.set("name", name);
	url.searchParams.set("type", "TXT");

	let response = await wrap(() => fetch(url, { headers: { Accept: "application/dns-json" } }));
	if (isFailure(response)) return response;
	if (!response.data.ok) {
		return failure(new Error(`DNS query failed with status ${response.data.status}`));
	}

	let body = await wrap(async () => s.parse(DnsResponseSchema, await response.data.json()));
	if (isFailure(body)) return body;

	let status = body.data.Status;
	if (status === NXDOMAIN) return success([]);
	if (status !== 0) return failure(new Error(`DNS query returned status code ${status}`));

	let texts: string[] = [];
	for (let record of body.data.Answer ?? []) {
		if (record.type !== TXT_TYPE_CODE) continue;
		let text = readCharacterStrings(record.data);
		if (text !== null) texts.push(text);
	}
	return success(texts);
}

/**
 * Costs are apportioned to the domain's own team, since verifying it is work that team
 * asked for by adding the domain. `domain.verified` is logged only for a lookup that
 * answered; a failed one logs `domains.lookup_failed` and leaves the retry to the sweep.
 */
export default createJobHandler(jobs.verifyDomainOwnership, async (ctx) => {
	let domain = await TeamDomain.findById(ctx.database, ctx.input.teamDomainId);
	if (!domain || domain.verified_at !== null) return;

	apportionCostByTeam([domain.team_id]);
	ctx.log.set({ domain: { id: domain.id }, team: { id: domain.team_id } });

	let records = await lookupTxtRecords(`_ping-verification.${domain.hostname}`);
	if (isFailure(records)) {
		ctx.log.warn("domains.lookup_failed", { error: records.error.message });
		return;
	}

	let verified = records.data.includes(`ping_${domain.id}`);
	if (verified) await TeamDomain.markVerified(ctx.database, domain.id);

	ctx.log.set({ domain: { verified } });
});
