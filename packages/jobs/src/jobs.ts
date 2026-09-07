/**
 * `jobs()`, which turns declared leaves into the app's job map. It stamps each leaf with
 * the key it is filed under, which is the name that job is addressed by on the wire. The
 * map is declaration and nothing else: it holds no handler and reaches no queue, so importing it
 * costs its schemas, and both the dispatcher and an app's own enqueue helper read from it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@sdxc/types";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import type { CronExpression, JobLeaf } from "./job.js";

import { leaf } from "./job.js";

/** A declared job whatever its schema, for the places that hold many at once. */
// oxlint-disable-next-line typescript/no-explicit-any -- leaves vary by schema and meta
export type AnyJobLeaf = JobLeaf<any, any>;

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

/** What a handler receives for a job: whatever its schema parsed to. */
export type JobOutput<Schema> = Schema extends StandardSchemaV1
	? StandardSchemaV1.InferOutput<Schema>
	: undefined;

/** One named job, bound to the queue its map was built with. */
export interface JobDefinition<
	Schema extends StandardSchemaV1 | undefined = undefined,
	Meta = undefined,
> {
	/** The name this job is addressed by on the wire, from the key it is filed under. */
	readonly name: string;
	readonly cron: CronExpression | undefined;
	readonly input: Schema | undefined;
	/** What the leaf declared, `undefined` when it declared none. */
	readonly meta: Meta;
}

/** The map `jobs()` returns: the declared shape, with every leaf named and bound. */
export type JobMap<Tree> = {
	[Key in keyof Tree]: Tree[Key] extends JobLeaf<infer Schema, infer Meta>
		? JobDefinition<Schema, Meta>
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
	Definition extends JobDefinition<infer Schema, infer _Meta> ? EnqueueInput<Schema> : never;

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
	Definition extends JobDefinition<infer Schema, infer _Meta> ? EnqueueArgs<Schema> : never;

/** A definition whatever its schema, for the places that hold many at once. */
// oxlint-disable-next-line typescript/no-explicit-any -- definitions vary by schema and meta
export type AnyJobDefinition = JobDefinition<any, any>;

/** True for a value `job()` produced, false for a group of them. */
function isLeaf(value: AnyJobLeaf | JobTree): value is AnyJobLeaf {
	return leaf in value;
}

/**
 * The body one message carries: the job it names, and the payload beside it under `body`. The
 * payload keeps a namespace of its own, so a job whose input declares a `job` or a `type` field
 * carries it intact. Exported for an app that sends through its own helper rather than the
 * dispatcher.
 *
 * @param job The job the message is for.
 * @param input The payload, absent for a job that declares no schema.
 * @example await sendQueueBatch([messageBody(jobs.checkHttp, { monitorId })]);
 */
export function messageBody(job: AnyJobDefinition, input?: unknown): JSONValue {
	return envelope(job.name, input);
}

/**
 * The envelope itself, named by job rather than by definition, so an adapter serializing a
 * `JobMessage` and a call site holding a definition write the same wire shape.
 *
 * @param job The name the message is addressed to.
 * @param input The payload, absent for a job that declares no schema.
 */
export function envelope(job: string, input?: unknown): JSONValue {
	if (input === undefined) return { job } as JSONValue;
	return { job, body: input } as JSONValue;
}

/** The job a delivered body names, and the payload it carries. */
export interface DeliveredBody {
	job: string | undefined;
	payload: unknown;
}

/**
 * Reads a delivered body, accepting the envelope and the flat body that preceded it. A flat body
 * carries its payload's fields beside `type`, so the body is its own payload; this is what lets a
 * deploy consume what the one before it enqueued.
 *
 * @param body The delivered body, of whatever shape.
 */
export function readMessageBody(body: unknown): DeliveredBody {
	if (typeof body !== "object" || body === null) return { job: undefined, payload: undefined };

	if ("job" in body && typeof body.job === "string") {
		return { job: body.job, payload: "body" in body ? body.body : undefined };
	}

	if ("type" in body && typeof body.type === "string") return { job: body.type, payload: body };

	return { job: undefined, payload: undefined };
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
		input: declared.input,
		meta: declared.meta,
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
