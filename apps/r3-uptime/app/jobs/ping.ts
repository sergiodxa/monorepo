/**
 * Background job that triggers a scheduled HTTP monitor check. Validates its
 * `{ monitorId, ownerId }` input, skips (non-retriably) when the team owner has no
 * active subscription, and otherwise starts the `PING` workflow for the monitor. It
 * exists to gate automated monitoring on billing and run each check off the request
 * path.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Job } from "@pkg/jobs";
import { PolarClient } from "@pkg/polar";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";

import Customer from "~/app/data/customer";
import Monitor from "~/app/data/monitor";

const PingJobSchema = s.object({ monitorId: s.string(), ownerId: s.string() });

export class PingJob extends Job {
	static schema = PingJobSchema;

	async perform(): Promise<void> {
		let result = await validate(this.input, PingJob.schema);

		if (isFailure(result)) {
			this.logger.error("job.ping.invalid_input", { input: this.input });
			throw new Job.NonRetriableError("Invalid input", { cause: result.error });
		}

		let { monitorId, ownerId } = result.data;

		let polar = getServiceContainer().get(PolarClient);
		let hasActiveSubscription = await Customer.hasActiveSubscription(polar, ownerId);

		if (!hasActiveSubscription) {
			this.logger.info("job.ping.skipped", { reason: "no_subscription", monitorId, ownerId });
			return;
		}

		this.logger.info("job.ping.triggering", { monitorId });
		await Monitor.ping(monitorId);
	}
}

export namespace PingJob {
	export type Input = s.InferOutput<typeof PingJobSchema>;
}
