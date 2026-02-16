import { Job } from "@pkg/jobs";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { z } from "zod";

import database from "~/db/index";
import * as schema from "~/db/schema";
import { dnsLookup } from "~/utils/dns-lookup";

export class VerifyDomainOwnershipJob extends Job {
	static schema = z.object({ teamDomainId: z.string() });

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

		let verified = await dnsLookup(teamDomain.hostname, teamDomain.id);

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
}

export namespace VerifyDomainOwnershipJob {
	export type Input = z.infer<typeof VerifyDomainOwnershipJob.schema>;
}
