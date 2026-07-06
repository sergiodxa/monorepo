/**
 * Queued job that verifies a team's ownership of a custom domain by performing a
 * DNS-over-HTTPS TXT lookup on `_ping-verification.<hostname>` and matching the
 * expected token. On success it stamps the team domain's `verifiedAt`; on failure
 * it logs the outcome. It gates custom-domain features behind proven ownership.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Job } from "@pkg/jobs";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { z } from "zod";

import database from "~/db/index";
import * as schema from "~/db/schema";

export class VerifyDomainOwnershipJob extends Job {
	static schema = z.object({ teamDomainId: z.string() });

	private static DNS_BASE_URL = new URL("https://cloudflare-dns.com/dns-query");
	private static DNSResponseSchema = z.object({
		Answer: z
			.object({
				name: z.string(),
				type: z.number(),
				TTL: z.number(),
				data: z.string(),
			})
			.array()
			.optional(),
	});

	async perform(): Promise<void> {
		let result = await validate(this.input, VerifyDomainOwnershipJob.schema);

		if (isFailure(result)) {
			throw new Job.NonRetriableError("Invalid input", { cause: result.error });
		}

		let { teamDomainId } = result.data;
		let db = database(env.DB);

		this.logger.info("database.query", {
			table: "teamDomains",
			operation: "findFirst",
			teamDomainId,
		});

		let teamDomain = await db.query.teamDomains.findFirst({
			where(fields, operators) {
				return operators.eq(fields.id, teamDomainId);
			},
		});

		if (!teamDomain) {
			return this.logger.info("job.verify-domain-ownership.skipped", {
				teamDomainId,
				reason: "not_found",
			});
		}

		this.logger.info("dns.lookup", {
			hostname: teamDomain.hostname,
			teamDomainId,
		});

		let verified = await this.lookup(teamDomain.hostname, teamDomain.id);

		if (verified) {
			this.logger.info("database.update", {
				table: "teamDomains",
				teamDomainId,
				field: "verifiedAt",
			});

			await db
				.update(schema.teamDomains)
				.set({ verifiedAt: new Date() })
				.where(eq(schema.teamDomains.id, teamDomain.id));

			this.logger.info("job.verify-domain-ownership.verified", {
				teamDomainId,
				hostname: teamDomain.hostname,
			});
		} else {
			this.logger.info("job.verify-domain-ownership.failed", {
				teamDomainId,
				hostname: teamDomain.hostname,
				reason: "dns_lookup_failed",
			});
		}
	}

	private async lookup(domain: string, expectedValue: string) {
		let url = new URL(VerifyDomainOwnershipJob.DNS_BASE_URL);
		url.searchParams.set("name", `_ping-verification.${domain}`);
		url.searchParams.set("type", "TXT");

		let headers = new Headers();
		headers.set("Accept", "application/dns-json");

		let response = await fetch(url, { headers });

		if (!response.ok) throw new Error(`Error fetching DNS: ${response.status}`);

		let unparsedBody = await response.json();

		this.logger.info("dns.lookup.response", { url: url.toString(), response: unparsedBody });

		let body = VerifyDomainOwnershipJob.DNSResponseSchema.parse(unparsedBody);

		this.logger.info("dns.lookup.parsedResponse", { url: url.toString(), response: body });

		if (!body.Answer) {
			this.logger.info("dns.lookup.noAnswer", { url: url.toString() });
			return false;
		}

		return body.Answer.some((r) => r.data === JSON.stringify(`ping_${expectedValue}`));
	}
}

export namespace VerifyDomainOwnershipJob {
	export type Input = z.infer<typeof VerifyDomainOwnershipJob.schema>;
}
