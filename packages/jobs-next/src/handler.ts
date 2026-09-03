/**
 * `createJobHandler()`, which pairs a handler with the job it runs. Passing the
 * definition is what types the payload; an app that augments {@link JobTypes}
 * with its dispatcher's context also gets whatever its middleware installed, so a
 * handler reads `ctx.input` and `ctx.database` with their real types.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";

import type { JobContext, JobContextInit } from "./context";
import type { JobDefinition } from "./jobs";

import { JobContext as Context } from "./context";

/**
 * Augmented by an app to name the context its handlers receive, the way
 * `RouterTypes` does for routes.
 *
 * @example
 * declare module "@pkg/jobs-next" {
 * 	interface JobTypes {
 * 		context: JobDispatcherContext<typeof dispatcher>;
 * 	}
 * }
 */
// oxlint-disable-next-line typescript/no-empty-object-type -- the seam apps augment
export interface JobTypes {}

/** The context a handler receives: the app's, or the bare one until it declares its own. */
export type CurrentJobContext = JobTypes extends { context: infer Context }
	? Context
	: JobContext<unknown>;

/** What a job's schema hands its handler, or nothing for a job without one. */
export type HandlerInput<Schema> = Schema extends StandardSchemaV1
	? StandardSchemaV1.InferOutput<Schema>
	: undefined;

/** The context one job's handler receives, with its own payload typed onto it. */
export type JobHandlerContext<Schema> = CurrentJobContext & {
	readonly input: HandlerInput<Schema>;
};

/** The work itself, as it is written. */
export type JobHandlerFunction<Schema extends StandardSchemaV1 | undefined = undefined> = (
	context: JobHandlerContext<Schema>,
) => Promise<void> | void;

/** The work, paired with the job it was written for. */
export interface JobHandler<Schema extends StandardSchemaV1 | undefined = undefined> {
	(context: JobHandlerContext<Schema>): Promise<void> | void;
	/** The job this handler was created for, which the dispatcher checks it was mapped to. */
	readonly job: JobDefinition<Schema>;
}

/** A handler whatever it runs, for the places that hold any of them. */
// oxlint-disable-next-line typescript/no-explicit-any -- payloads vary per job
export type AnyJobHandler = JobHandler<any>;

/**
 * Pairs a handler with its job.
 *
 * @param job The job this handler runs, from the app's map.
 * @param handler The work, receiving one context.
 * @returns The handler, carrying the job it belongs to.
 * @example export default createJobHandler(jobs.clean, async ({ logger }) => { … });
 */
export function createJobHandler<Schema extends StandardSchemaV1 | undefined>(
	job: JobDefinition<Schema>,
	handler: JobHandlerFunction<Schema>,
): JobHandler<Schema> {
	return Object.assign((context: JobHandlerContext<Schema>) => handler(context), { job });
}

/**
 * Builds a context typed the way a handler receives it, for calling one directly.
 *
 * A handler's context type is whatever the app declared its middleware installs, and
 * building one here skips that chain — so the caller populates what the chain would
 * have, with `set(key, value, { property })`, and the type takes them at their word.
 *
 * @param job The job whose handler is under test.
 * @param init The delivery to run it for.
 * @returns A context the handler accepts.
 * @example
 * let ctx = createJobContext(jobs.clean, { id: "message-1", attempts: 1 });
 * ctx.set(Database, await testDatabase(), { property: "database" });
 * await handler(ctx);
 */
export function createJobContext<Schema extends StandardSchemaV1 | undefined = undefined>(
	job: JobDefinition<Schema>,
	init: JobContextInit<HandlerInput<Schema>>,
): JobHandlerContext<Schema> {
	return new Context(job, init) as JobHandlerContext<Schema>;
}
