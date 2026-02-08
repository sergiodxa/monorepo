import { BatchedLogger } from "@pkg/logger";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";

import database from "~/db/index";
import * as schema from "~/db/schema";
import { dnsLookup } from "~/utils/dns-lookup";

import type { Job } from "./base";

export default class VerifyDomainOwnershipJob implements Job {
	private db = database(env.DB);
	private logger: BatchedLogger;

	constructor(private teamDomainId: string) {
		this.logger = new BatchedLogger(`job:verify-domain-ownership:${teamDomainId}`);
	}

	async run(message: Message): Promise<void> {
		let teamDomainId = this.teamDomainId;

		try {
			this.logger.info("job.verify-domain-ownership.started", {
				messageId: message.id,
				teamDomainId,
			});

			this.logger.info("database.query", {
				table: "teamDomains",
				operation: "findFirst",
				teamDomainId,
			});
			let teamDomain = await this.db.query.teamDomains.findFirst({
				where(fields, operators) {
					return operators.eq(fields.id, teamDomainId);
				},
			});

			if (!teamDomain) {
				this.logger.info("job.verify-domain-ownership.skipped", {
					teamDomainId,
					reason: "not_found",
				});
				return message.ack();
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
				await this.db
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

			return message.ack();
		} catch (error) {
			this.logger.error("job.verify-domain-ownership.error", {
				teamDomainId,
				error: error instanceof Error ? error.message : String(error),
			});
			return message.retry();
		} finally {
			this.logger.flush();
		}
	}
}
