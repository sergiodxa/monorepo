/**
 * What uptime's model callbacks read besides the database: the rest of the registry, bound to
 * the same request or job, and the enqueuer a write's `afterCommit` sends its follow-up jobs
 * through, so a job goes out only for a write that was kept.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { BoundRegistry } from "@sdxc/data-model";
import type { JobEnqueuer } from "@sdxc/jobs";

import type { models } from "~/app/models";

declare module "@sdxc/data-model" {
	interface ModelContext {
		/** Every model, bound to the same database and unit of work as the one calling. */
		models: BoundRegistry<typeof models>;
		/** The request's `ctx.jobs`, or the module enqueuer where no request is running. */
		jobs: JobEnqueuer;
	}
}

export {};
