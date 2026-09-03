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
	 * in `wrangler.jsonc`. Omit for a job that is only ever enqueued explicitly.
	 */
	cron?: string;
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
	return { ...options, [leaf]: true };
}
