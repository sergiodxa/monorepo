/**
 * The background `PingJob` that triggers a scheduled HTTP monitor check. It validates its
 * `{ monitorId, ownerId }` input, skips (non-retriably on bad input) when the owner has no
 * active subscription, and otherwise invokes the monitor model to enqueue the ping. It
 * exists to gate automated monitoring on billing and run each check off the request path.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Job } from "@pkg/jobs";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { env } from "cloudflare:workers";
import { z } from "zod";

import type { SelectMonitor, SelectTeam } from "~/db/schema";

import database from "~/db/index";
import Customer from "~/models/customer";
import Monitor from "~/models/monitor";

export class PingJob extends Job {
	static schema = z.object({ monitorId: z.string(), ownerId: z.string() });

	async perform(): Promise<void> {
		let result = await validate(this.input, PingJob.schema);

		if (isFailure(result)) {
			this.logger.error("job.ping.invalid_input", { input: this.input });
			throw new Job.NonRetriableError("Invalid input", { cause: result.error });
		}

		let { monitorId, ownerId } = result.data;

		this.logger.info("subscription.check", { ownerId });
		let hasActiveSubscription = await Customer.hasActiveSubscription(ownerId);

		if (!hasActiveSubscription) {
			this.logger.info("job.ping.skipped", { reason: "no_subscription" });
			return;
		}

		this.logger.info("subscription.verified", { ownerId });

		let db = database(env.DB);

		this.logger.info("monitor.ping", { monitorId });
		await Monitor.ping(db, monitorId);
	}
}

export namespace PingJob {
	export type Input = {
		monitorId: SelectMonitor["id"];
		ownerId: SelectTeam["ownerId"];
	};
}
