/**
 * Background job that checks one team domain's DNS TXT record for the ownership
 * token and marks it verified on a match. A DNS-over-HTTPS lookup of
 * `_ping-verification.<hostname>` must return a TXT record whose value is
 * the literal string `ping_<teamDomainId>` (the DNS-JSON API returns TXT record
 * content JSON-quoted, hence comparing against `JSON.stringify(...)`). A miss leaves
 * the domain pending for `EnqueuePendingDomainsJob` to retry on its next sweep.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Job } from "@pkg/jobs";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";

import TeamDomain from "~/app/data/team-domain";
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

const VerifyDomainOwnershipJobSchema = s.object({ teamDomainId: s.string() });

export class VerifyDomainOwnershipJob extends Job {
	static schema = VerifyDomainOwnershipJobSchema;

	/**
	 * Costs are apportioned to the domain's own team, since verifying it is work
	 * that team asked for by adding the domain.
	 */
	async perform(): Promise<void> {
		let result = await validate(this.input, VerifyDomainOwnershipJob.schema);
		if (isFailure(result)) {
			this.logger.error("job.verify_domain_ownership.invalid_input", { input: this.input });
			throw new Job.NonRetriableError("Invalid input", { cause: result.error });
		}

		let db = getServiceContainer().get(Database);
		let domain = await TeamDomain.findById(db, result.data.teamDomainId);
		if (!domain || domain.verified_at !== null) return;

		apportionCostByTeam([domain.team_id]);

		let url = new URL("https://cloudflare-dns.com/dns-query");
		url.searchParams.set("name", `_ping-verification.${domain.hostname}`);
		url.searchParams.set("type", "TXT");

		try {
			let response = await fetch(url, { headers: { Accept: "application/dns-json" } });
			let body = s.parse(DnsAnswerSchema, await response.json());
			let expected = JSON.stringify(`ping_${domain.id}`);
			let verified = (body.Answer ?? []).some((record) => record.data === expected);

			if (verified) {
				await TeamDomain.markVerified(db, domain.id);
				this.logger.info("job.verify_domain_ownership.verified", { teamDomainId: domain.id });
			} else {
				this.logger.info("job.verify_domain_ownership.pending", { teamDomainId: domain.id });
			}
		} catch (error) {
			this.logger.error("job.verify_domain_ownership.lookup_failed", {
				teamDomainId: domain.id,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
}

export namespace VerifyDomainOwnershipJob {
	export type Input = s.InferOutput<typeof VerifyDomainOwnershipJobSchema>;
}
