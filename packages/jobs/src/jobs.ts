/**
 * `jobs()`, which turns declared leaves into the app's job map. It stamps each leaf with
 * the key it is filed under, which is the message `type` that job is known by. The map is
 * declaration and nothing else: it holds no handler and reaches no queue, so importing it
 * costs its schemas, and both the dispatcher and an app's own enqueue helper read from it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@sdxc/types";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import type { CronExpression, JobLeaf } from "./job";

import { leaf } from "./job";

/** A declared job whatever its schema, for the places that hold many at once. */
// oxlint-disable-next-line typescript/no-explicit-any -- leaves vary by schema
export type AnyJobLeaf = JobLeaf<any>;

/** A group of declared jobs, nested as deeply as an app cares to group them. */
export interface JobTree {
	[key: string]: AnyJobLeaf | JobTree;
}

/** What enqueuing takes for a job: whatever its schema accepts. */
export type EnqueueInput<Schema> = Schema extends StandardSchemaV1
	? StandardSchemaV1.InferInput<Schema>
	: never;

/** A job that takes no payload takes no argument either. */
export type EnqueueArgs<Schema> = Schema extends StandardSchemaV1
	? [input: EnqueueInput<Schema>]
	: [];

/** One named job, bound to the queue its map was built with. */
export interface JobDefinition<Schema extends StandardSchemaV1 | undefined = undefined> {
	/** The message `type`, from the key this job is filed under. */
	readonly name: string;
	readonly cron: CronExpression | undefined;
	readonly monitorId: string | undefined;
	readonly input: Schema | undefined;
}

/** The map `jobs()` returns: the declared shape, with every leaf named and bound. */
export type JobMap<Tree> = {
	[Key in keyof Tree]: Tree[Key] extends JobLeaf<infer Schema>
		? JobDefinition<Schema>
		: JobMap<Tree[Key]>;
};

/**
 * What enqueuing one job takes, named from the definition rather than its schema, so an
 * app writing its own enqueue helper does not have to name the schema library.
 *
 * @example
 * export function enqueue<Job extends AnyJobDefinition>(job: Job, input: JobInput<Job>) {
 * 	return sendQueueBatch([messageBody(job, input)]);
 * }
 */
export type JobInput<Definition> =
	Definition extends JobDefinition<infer Schema> ? EnqueueInput<Schema> : never;

/**
 * What enqueuing one job takes as arguments: its payload, or nothing at all for a job
 * that declares no schema. The variadic half of {@link JobInput}.
 *
 * @example
 * export function enqueue<Job extends AnyJobDefinition>(job: Job, ...input: JobArgs<Job>) {
 * 	return sendQueueBatch([messageBody(job, input[0])]);
 * }
 */
export type JobArgs<Definition> =
	Definition extends JobDefinition<infer Schema> ? EnqueueArgs<Schema> : never;

/** A definition whatever its schema, for the places that hold many at once. */
// oxlint-disable-next-line typescript/no-explicit-any -- definitions vary by schema
export type AnyJobDefinition = JobDefinition<any>;

/** True for a value `job()` produced, false for a group of them. */
function isLeaf(value: AnyJobLeaf | JobTree): value is AnyJobLeaf {
	return leaf in value;
}

/**
 * The body one message carries: the payload's own fields, plus the `type` that names the
 * job. `type` is written last, so a payload carrying one of its own cannot misroute the
 * message; the key is reserved. Exported for an app that sends through its own helper
 * rather than through the dispatcher.
 *
 * @param job The job the message is for.
 * @param input The payload, absent for a job that declares no schema.
 * @example await sendQueueBatch([messageBody(jobs.checkHttp, { monitorId })]);
 */
export function messageBody(job: AnyJobDefinition, input?: unknown): JSONValue {
	return { ...(input as object), type: job.name } as JSONValue;
}

/**
 * Names one leaf.
 * @param name The dot-joined path this leaf is filed under.
 * @param declared The leaf `job()` produced.
 */
function define(name: string, declared: AnyJobLeaf): AnyJobDefinition {
	return {
		name,
		cron: declared.cron,
		monitorId: declared.monitorId,
		input: declared.input,
	};
}

/**
 * Builds the app's job map.
 *
 * @param tree The declared jobs, keyed by the name each is known by on the wire.
 * @returns The same shape, with every leaf named after the key it is filed under.
 * @example export default jobs({ clean: job({ cron: "0 0 * * *" }) });
 */
export function jobs<const Tree extends JobTree>(tree: Tree): JobMap<Tree> {
	return build(tree, "") as JobMap<Tree>;
}

/**
 * Walks one level of the declared tree, naming leaves and recursing into groups.
 * @param tree The level being walked.
 * @param prefix The dot-joined path of the group being walked, empty at the root.
 */
function build(tree: JobTree, prefix: string): Record<string, unknown> {
	let map: Record<string, unknown> = {};

	for (let [key, value] of Object.entries(tree)) {
		let name = prefix === "" ? key : `${prefix}.${key}`;
		map[key] = isLeaf(value) ? define(name, value) : build(value, name);
	}

	return map;
}
