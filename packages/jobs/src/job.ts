/**
 * `job()`, which declares one leaf of a job map: what payload it carries, when it
 * is triggered, and which monitor watches it. A leaf carries no name — `jobs()`
 * stamps that from the key it is filed under — and no handler, so importing a map
 * costs its schemas and nothing else.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";

import { Schedule } from "@sdxc/cron";
import { isFailure } from "@sdxc/result";

/**
 * The five fields a cron trigger is written in. Catches an expression with too few of
 * them, and anything that is not one at all, where the checking costs nothing; the
 * ranges, steps, and lists inside each field are checked when the job is declared.
 */
export type CronExpression = `${string} ${string} ${string} ${string} ${string}`;

/** Marks a value as declared by `job()`, so `jobs()` can tell a leaf from a group. */
export const leaf: unique symbol = Symbol("jobs.leaf");

/** What a job declares about itself. */
export interface JobOptions<Schema extends StandardSchemaV1 | undefined = undefined> {
	/**
	 * Schema for the message payload, parsed before the handler runs. Object schemas
	 * only: a body is the payload's own fields plus the reserved `type`.
	 */
	input?: Schema;
	/**
	 * Cron expression this job is enqueued on, spelled exactly as the matching trigger
	 * in `wrangler.jsonc`. Parsed when the job is declared, so an expression no platform
	 * would accept throws here. Omit for a job that is only ever enqueued explicitly.
	 */
	cron?: CronExpression;
	/** Uptime cron monitor to ping once a run completes. */
	monitorId?: string;
}

/** One declared job, before `jobs()` gives it its name and its queue. */
export interface JobLeaf<
	Schema extends StandardSchemaV1 | undefined = undefined,
> extends JobOptions<Schema> {
	readonly [leaf]: true;
}

/**
 * Declares one job for a `jobs()` map.
 *
 * @param options What the job carries, when it runs, and what watches it.
 * @returns The leaf to file under the name this job is known by.
 * @example checkHttp: job({ input: s.object({ monitorId: s.string() }) })
 */
export function job<Schema extends StandardSchemaV1 | undefined = undefined>(
	options: JobOptions<Schema> = {},
): JobLeaf<Schema> {
	if (options.cron !== undefined) {
		/**
		 * Declaring a schedule the platform would reject is a deploy-time mistake, so it
		 * fails the upload rather than a delivery: a job whose expression never matches a
		 * trigger is silence at 3am, which is the failure this package exists to catch.
		 */
		let schedule = Schedule.parse(options.cron);
		if (isFailure(schedule)) throw schedule.error;
	}

	return { ...options, [leaf]: true };
}
