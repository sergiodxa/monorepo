import { logger } from "@pkg/logger";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";

import database from "~/db/index";
import * as schema from "~/db/schema";
import { dnsLookup } from "~/utils/dns-lookup";

import type { Job } from "./base";

export default class VerifyDomainOwnershipJob implements Job {
	private db = database(env.DB);

	constructor(private teamDomainId: string) {}

	async run(message: Message): Promise<void> {
		let teamDomainId = this.teamDomainId;

		let teamDomain = await this.db.query.teamDomains.findFirst({
			where(fields, operators) {
				return operators.eq(fields.id, teamDomainId);
			},
		});

		if (!teamDomain) {
			logger.info("verify-domain-ownership.skipped", {
				teamDomainId,
				reason: "not_found",
			});
			return message.ack();
		}

		try {
			let verified = await dnsLookup(teamDomain.hostname, teamDomain.id);

			if (verified) {
				await this.db
					.update(schema.teamDomains)
					.set({ verifiedAt: new Date() })
					.where(eq(schema.teamDomains.id, teamDomain.id));

				logger.info("verify-domain-ownership.verified", {
					teamDomainId,
					hostname: teamDomain.hostname,
				});
			} else {
				logger.info("verify-domain-ownership.failed", {
					teamDomainId,
					hostname: teamDomain.hostname,
					reason: "dns_lookup_failed",
				});
			}
		} catch (error) {
			logger.error("verify-domain-ownership.error", {
				teamDomainId,
				hostname: teamDomain.hostname,
				error: error instanceof Error ? error.message : String(error),
			});
		}

		return message.ack();
	}
}
