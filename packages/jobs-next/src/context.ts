/**
 * The context every middleware and handler shares for one delivery. It carries
 * the job's own declaration, the message it is running for, the two verbs that
 * settle that message, and the typed key store middleware publishes through, so
 * a handler reads what it needs off one object and a test builds that object itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Message } from "@cloudflare/workers-types";
import type { DurationInput } from "@pkg/duration";
import type { ContextValue } from "remix/router";

import { toSeconds } from "@pkg/duration";
import { BatchedLogger } from "@pkg/logger";

import type { AnyJobDefinition } from "./jobs";

/** How a delivery ended, once something settled it. */
export type Settlement = { type: "ack" } | { type: "retry"; delay: DurationInput | undefined };

/** Options `ctx.retry()` accepts. */
export interface RetryDeliveryOptions {
	/** How long the platform holds the message before redelivering it. */
	delay?: DurationInput;
}

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
	/** Where this job's events go. One is created for the job when omitted. */
	logger?: BatchedLogger;
	/** Aborts when the job's timeout expires. Never aborts when omitted. */
	signal?: AbortSignal;
	/**
	 * The delivery being run. Omitting it — as a test does — keeps `ack` and `retry`
	 * recording the outcome on {@link JobContext.settlement} instead of calling the platform.
	 */
	message?: Message<unknown>;
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
	readonly cron: string | undefined;
	/** The uptime monitor this job reports to, when it declares one. */
	readonly monitorId: string | undefined;
	/** The payload, parsed against the job's schema. */
	readonly input: Input;
	readonly id: string;
	readonly attempts: number;
	/** How many messages share this invocation, for a job pricing its share of it. */
	readonly batchSize: number;
	readonly logger: BatchedLogger;
	/** Aborts when the job's timeout expires; pass it to `fetch`, or read it in a loop. */
	readonly signal: AbortSignal;

	readonly #values = new Map<object, unknown>();
	readonly #message: Message<unknown> | undefined;
	#settlement: Settlement | undefined;

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
		this.logger = init.logger ?? new BatchedLogger(`job:${job.name}:${init.id}`);
		this.signal = init.signal ?? new AbortController().signal;
		this.#message = init.message;
	}

	/** How this delivery was settled, or `undefined` while nothing has settled it. */
	get settlement(): Settlement | undefined {
		return this.#settlement;
	}

	/**
	 * Settles this delivery now and returns. The run continues, so a job whose work is
	 * already durable can release the message before a slow tail finishes.
	 */
	ack = (): void => {
		if (this.#settlement !== undefined) return;
		this.#settlement = { type: "ack" };
		this.#message?.ack();
	};

	/**
	 * Settles this delivery for redelivery and returns; the handler is expected to
	 * return next. Prefer throwing when giving up, which cannot be forgotten.
	 *
	 * @param options How long to hold the message before it comes back.
	 * @example ctx.retry({ delay: "5 minutes" });
	 */
	retry = (options?: RetryDeliveryOptions): void => {
		if (this.#settlement !== undefined) return;
		this.#settlement = { type: "retry", delay: options?.delay };
		this.#message?.retry(
			options?.delay === undefined ? {} : { delaySeconds: toSeconds(options.delay) },
		);
	};

	/**
	 * Reads a value some middleware published.
	 * @param key The context key to read.
	 * @returns Its value, the key's default, or `undefined`.
	 */
	get = <Key extends object>(key: Key): ContextValue<Key> | undefined => {
		if (this.#values.has(key)) return this.#values.get(key) as ContextValue<Key>;
		return (key as { defaultValue?: ContextValue<Key> }).defaultValue;
	};

	/**
	 * Whether a value has been published for a key.
	 * @param key The context key to check.
	 */
	has = (key: object): boolean => this.#values.has(key);

	/**
	 * Publishes a value for a key, optionally installing it as a direct property so
	 * handlers read `ctx.database` rather than `ctx.get(Database)`.
	 *
	 * @param key The context key to write.
	 * @param value The value to publish.
	 * @param options The property name to install it under.
	 */
	set = <Key extends object>(
		key: Key,
		value: ContextValue<Key>,
		options?: { property: string },
	): void => {
		this.#values.set(key, value);

		if (options === undefined) return;

		Object.defineProperty(this, options.property, {
			value,
			configurable: true,
			enumerable: true,
			writable: false,
		});
	};
}

/** A context whatever payload it carries, for the places that hold any of them. */
// oxlint-disable-next-line typescript/no-explicit-any -- payloads vary per job
export type AnyJobContext = JobContext<any>;
