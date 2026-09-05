/**
 * The context every middleware and handler shares for one delivery. It carries the
 * job's own declaration, the message it is running for, the typed key store middleware
 * publishes through, and the four verbs that end a delivery. Each verb throws, so a job
 * that decides how its delivery ends stops there and cannot forget to stop.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ContextValue } from "remix/router";

import { BatchedLogger, currentLog, Log } from "@sdxc/logger";

import type { RetryOptions } from "./errors.js";
import type { CronExpression } from "./job.js";
import type { AnyJobDefinition } from "./jobs.js";

import { Ack, NonRetriable, Retry, Timeout } from "./errors.js";

/** What a context needs to exist, beyond the job it is running. */
export interface JobContextInit<Input = undefined> {
	/** The queue message's id. */
	id: string;
	/** Which delivery of this message this is, counting from one. */
	attempts: number;
	/** The payload, already parsed against the job's schema. */
	input?: Input;
	/** How many messages share the invocation this job runs in. Defaults to one. */
	batchSize?: number;
	/** Where this job's fields go. One is created when omitted. */
	log?: Log;
	/** Where this job's events go, while handlers still write to one. Created when omitted. */
	logger?: BatchedLogger;
	/** Aborts when the job's timeout expires. Never aborts when omitted. */
	signal?: AbortSignal;
}

/**
 * Opens the log one job's run is recorded in. Inside a queue batch it is a child of the
 * batch's log, so the batch counts it and degrades when it does; anywhere else it stands
 * alone, which is how a dispatcher under test runs unchanged.
 *
 * @param fields What is known about the job before it runs.
 * @example let log = openJobLog({ job: { name: job.name, id: message.id, attempts: message.attempts } });
 */
export function openJobLog(fields: Log.Fields): Log {
	let batch = currentLog();
	return batch === undefined ? new Log({ kind: "job" }, fields) : batch.child("job", fields);
}

/**
 * One delivery's context.
 *
 * @example
 * let ctx = new JobContext(jobs.clean, { id: "message-1", attempts: 1 });
 * ctx.set(Database, testDatabase(), { property: "database" });
 * await handler(ctx);
 */
export class JobContext<Input = undefined> {
	/** The job's name, as its map key spells it. */
	readonly name: string;
	/** The schedule this job is enqueued on, when it declares one. */
	readonly cron: CronExpression | undefined;
	/** The uptime monitor this job reports to, when it declares one. */
	readonly monitorId: string | undefined;
	/** The payload, parsed against the job's schema. */
	readonly input: Input;
	readonly id: string;
	readonly attempts: number;
	/** How many messages share this invocation, for a job pricing its share of it. */
	readonly batchSize: number;
	/**
	 * This run's record: `set()` a field worth querying by, `note()` what is worth reading,
	 * `time()` anything with a duration. Emitted once, when the run ends.
	 */
	readonly log: Log;
	/** A batched logger, still available while handlers move their events into `log`. */
	readonly logger: BatchedLogger;
	/** Aborts when the job's timeout expires; pass it to `fetch`, or read it in a loop. */
	readonly signal: AbortSignal;

	readonly #values = new Map<object, unknown>();

	/**
	 * @param job The job being run, which supplies the name, schedule, and monitor.
	 * @param init The delivery, plus anything the caller wants to hand the handler.
	 */
	constructor(job: AnyJobDefinition, init: JobContextInit<Input>) {
		this.name = job.name;
		this.cron = job.cron;
		this.monitorId = job.monitorId;
		this.input = init.input as Input;
		this.id = init.id;
		this.attempts = init.attempts;
		this.batchSize = init.batchSize ?? 1;
		this.log =
			init.log ??
			openJobLog({
				job: {
					name: job.name,
					id: init.id,
					attempts: init.attempts,
					batch_size: this.batchSize,
					cron: job.cron,
				},
			});
		this.logger = init.logger ?? new BatchedLogger(`job:${job.name}:${init.id}`);
		this.signal = init.signal ?? new AbortController().signal;
	}

	/**
	 * Finishes here: the delivery is acked and the run is reported as completed.
	 * What returning does, from anywhere in the call stack.
	 *
	 * @param reason What finished the job early, for the thrown error's message.
	 * @throws {Ack} Always.
	 */
	ack(reason?: string): never {
		throw new Ack(reason);
	}

	/**
	 * Gives up on this delivery and asks for another.
	 *
	 * @param options Why it is coming back, how long to hold it, and what caused this.
	 * @throws {Retry} Always.
	 * @example ctx.retry({ delay: "5 minutes" });
	 */
	retry(options?: RetryOptions): never {
		throw new Retry(options?.reason, options);
	}

	/**
	 * Gives up for good: the delivery is acked, because a redelivery reaches the
	 * same result, and the run is reported as a failure.
	 *
	 * @param reason Why this message can never succeed.
	 * @param options The error that led here.
	 * @throws {NonRetriable} Always.
	 * @example ctx.exit("Team no longer exists", { cause: error });
	 */
	exit(reason?: string, options?: ErrorOptions): never {
		throw new NonRetriable(reason, options);
	}

	/**
	 * Gives up because time ran out: the delivery is retried, and no monitor is
	 * told the job ran.
	 *
	 * @param reason What was still outstanding.
	 * @throws {Timeout} Always.
	 * @example if (ctx.signal.aborted) ctx.timeout();
	 */
	timeout(reason?: string): never {
		throw new Timeout(reason);
	}

	/**
	 * Reads a value some middleware published.
	 * @param key The context key to read.
	 * @returns Its value, the key's default, or `undefined`.
	 */
	get<Key extends object>(key: Key): ContextValue<Key> | undefined {
		if (this.#values.has(key)) return this.#values.get(key) as ContextValue<Key>;
		return (key as { defaultValue?: ContextValue<Key> }).defaultValue;
	}

	/**
	 * Reads a value some middleware published, refusing to continue without it.
	 *
	 * A middleware sees the context as the bare one — an earlier middleware's installed
	 * property is not visible to it — so this is how one link reads what another put
	 * there without carrying an `undefined` it has no answer for.
	 *
	 * @param key The context key to read.
	 * @returns Its value.
	 * @throws When nothing published a value for that key.
	 * @example let database = ctx.require(Database);
	 */
	require<Key extends object>(key: Key): NonNullable<ContextValue<Key>> {
		let value = this.get(key);

		if (value === undefined || value === null) {
			throw new Error(`Job "${this.name}" read a context key that no middleware published`);
		}

		return value as NonNullable<ContextValue<Key>>;
	}

	/**
	 * Whether a value has been published for a key.
	 * @param key The context key to check.
	 */
	has(key: object): boolean {
		return this.#values.has(key);
	}

	/**
	 * Publishes a value for a key, optionally installing it as a direct property so
	 * handlers read `ctx.database` rather than `ctx.get(Database)`.
	 *
	 * @param key The context key to write.
	 * @param value The value to publish.
	 * @param options The property name to install it under.
	 */
	set<Key extends object>(
		key: Key,
		value: ContextValue<Key>,
		options?: { property: string },
	): void {
		this.#values.set(key, value);

		if (options === undefined) return;

		Object.defineProperty(this, options.property, {
			value,
			configurable: true,
			enumerable: true,
			writable: false,
		});
	}
}

/** A context whatever payload it carries, for the places that hold any of them. */
// oxlint-disable-next-line typescript/no-explicit-any -- payloads vary per job
export type AnyJobContext = JobContext<any>;
