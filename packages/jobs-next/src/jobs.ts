/**
 * `jobs()`, which turns declared leaves into the map an app enqueues through. It
 * stamps each leaf with the key it is filed under — the message `type` — and binds
 * every one of them to the sender the app passes, so a definition is a complete
 * value: importing the map is enough to enqueue, with no dispatcher and no registration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@pkg/types";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import type { JobLeaf } from "./job";

import { leaf } from "./job";

/**
 * Writes message bodies to the app's queue. A function rather than a `Queue`
 * binding, because the write is rarely only the write: an app that prices its
 * queue operations or chunks a batch at the platform's limit does that here.
 */
export type SendMessages = (bodies: JSONValue[]) => Promise<void>;

/** What a map needs beyond its declarations. */
export interface JobsOptions {
	send: SendMessages;
}

/** A declared job whatever its schema, for the places that hold many at once. */
// oxlint-disable-next-line typescript/no-explicit-any -- leaves vary by schema
export type AnyJobLeaf = JobLeaf<any>;

/** A group of declared jobs, nested as deeply as an app cares to group them. */
export interface JobTree {
	[key: string]: AnyJobLeaf | JobTree;
}

/** What `enqueue` takes for a job: whatever its schema accepts. */
export type EnqueueInput<Schema> = Schema extends StandardSchemaV1
	? StandardSchemaV1.InferInput<Schema>
	: never;

/** A job that takes no payload takes no argument either. */
export type EnqueueArgs<Schema> = Schema extends StandardSchemaV1
	? [input: EnqueueInput<Schema>]
	: [];

/**
 * Where a definition keeps the map's queue write. Not part of the public surface:
 * the dispatcher reaches for it to batch one cron's jobs into a single send, which a
 * definition cannot do for itself.
 */
export const sender: unique symbol = Symbol("jobs.send");

/** One named job, bound to the queue its map was built with. */
export interface JobDefinition<Schema extends StandardSchemaV1 | undefined = undefined> {
	/** The message `type`, from the key this job is filed under. */
	readonly name: string;
	readonly cron: string | undefined;
	readonly monitorId: string | undefined;
	readonly input: Schema | undefined;
	/**
	 * Enqueues one message for this job.
	 * @param input The payload, typed by the job's own schema.
	 */
	enqueue(...input: EnqueueArgs<Schema>): Promise<void>;
	/**
	 * Enqueues one message per input, in a single write. Enqueuing nothing does nothing.
	 * @param inputs One payload per message.
	 */
	enqueueMany(inputs: EnqueueInput<Schema>[]): Promise<void>;
	/** The map's queue write, for the dispatcher's own batching. */
	readonly [sender]: SendMessages;
}

/** The map `jobs()` returns: the declared shape, with every leaf named and bound. */
export type JobMap<Tree> = {
	[Key in keyof Tree]: Tree[Key] extends JobLeaf<infer Schema>
		? JobDefinition<Schema>
		: JobMap<Tree[Key]>;
};

/** A definition whatever its schema, for the places that hold many at once. */
// oxlint-disable-next-line typescript/no-explicit-any -- definitions vary by schema
export type AnyJobDefinition = JobDefinition<any>;

/** True for a value `job()` produced, false for a group of them. */
function isLeaf(value: AnyJobLeaf | JobTree): value is AnyJobLeaf {
	return leaf in value;
}

/**
 * The body one message carries: the payload's own fields, plus the `type` that
 * names the job. `type` is written last, so a payload carrying one of its own
 * cannot misroute the message; the key is reserved.
 * @param name The job's name.
 * @param input The payload, absent for a job that declares no schema.
 */
export function messageBody(name: string, input: unknown): JSONValue {
	return { ...(input as object), type: name } as JSONValue;
}

/**
 * Names one leaf and binds it to the map's sender.
 * @param name The dot-joined path this leaf is filed under.
 * @param declared The leaf `job()` produced.
 * @param send The map's queue write.
 */
function define(name: string, declared: AnyJobLeaf, send: SendMessages): AnyJobDefinition {
	return {
		[sender]: send,
		name,
		cron: declared.cron,
		monitorId: declared.monitorId,
		input: declared.input,
		async enqueue(input?: unknown) {
			await send([messageBody(name, input)]);
		},
		async enqueueMany(inputs: unknown[]) {
			if (inputs.length === 0) return;
			await send(inputs.map((input) => messageBody(name, input)));
		},
	};
}

/**
 * Builds the app's job map.
 *
 * @param tree The declared jobs, keyed by the name each is known by on the wire.
 * @param options The queue the map's `enqueue` writes to.
 * @returns The same shape, with every leaf named after its key and ready to enqueue.
 * @example export default jobs({ clean: job({ cron: "0 0 * * *" }) }, { send });
 */
export function jobs<const Tree extends JobTree>(tree: Tree, options: JobsOptions): JobMap<Tree> {
	return build(tree, options.send, "") as JobMap<Tree>;
}

/**
 * Walks one level of the declared tree, naming leaves and recursing into groups.
 * @param tree The level being walked.
 * @param send The map's queue write.
 * @param prefix The dot-joined path of the group being walked, empty at the root.
 */
function build(tree: JobTree, send: SendMessages, prefix: string): Record<string, unknown> {
	let map: Record<string, unknown> = {};

	for (let [key, value] of Object.entries(tree)) {
		let name = prefix === "" ? key : `${prefix}.${key}`;
		map[key] = isLeaf(value) ? define(name, value, send) : build(value, send, name);
	}

	return map;
}
