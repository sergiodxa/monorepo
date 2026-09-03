/**
 * `createJobDispatcher()`, which pairs handlers with the jobs an app declared and owns
 * both worker handlers. A cron delivery enqueues and never handles; a queue delivery
 * finds the job its message names, parses the body against that job's own schema,
 * and only then loads the handler, so an isolate serving requests never parses one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Message, MessageBatch, ScheduledController } from "@cloudflare/workers-types";
import type { DurationInput } from "@sdxc/duration";
import type { JSONValue } from "@sdxc/types";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { BatchedLogger } from "@sdxc/logger";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";

import type { JobContext } from "./context.js";
import type { AnyJobHandler, JobHandler, RunnableJobHandler } from "./handler.js";
import type { AnyJobDefinition, EnqueueArgs, EnqueueInput, JobDefinition } from "./jobs.js";
import type { AnyJobMiddleware, ChainProperties } from "./middleware.js";

import { messageBody } from "./jobs.js";
import { runJob } from "./lifecycle.js";

/** A handler module, however it is reached. */
export type HandlerModule = AnyJobHandler | { default: AnyJobHandler };

/** Where a job's handler comes from: a loader, or the handler itself. */
export type LoadHandler = () => HandlerModule | Promise<HandlerModule>;

/** Why a message was refused: it named no job, or it failed the job's schema. */
export type RefusalReason = "unknown-job" | "invalid-input";

/** The body a refused message is forwarded as, wrapped so its refusal is legible. */
export interface InvalidMessage {
	invalid: unknown;
}

/**
 * Writes message bodies to the app's queue. A function rather than a `Queue` binding,
 * because the write is rarely only the write: an app that prices its queue operations or
 * chunks a batch at the platform's limit does that here.
 */
export type SendMessages = (bodies: JSONValue[]) => Promise<void>;

/** What a dispatcher needs beyond the handlers mapped onto it. */
export interface JobDispatcherOptions<Chain extends readonly AnyJobMiddleware[] = []> {
	/**
	 * The app's queue write, used by `enqueue` and by the cron trigger. A dispatcher
	 * without one can still run what the queue delivers, and refuses to enqueue.
	 */
	send?: SendMessages;
	/** Runs around every job, in the order declared. Prefer an inline array. */
	middleware?: Chain;
	/** How long a job gets before its `ctx.signal` aborts and the dispatcher stops waiting. */
	timeout?: DurationInput;
	/** Resolves the bearer token a monitor ping is sent with. */
	uptime?: () => string | undefined;
	/**
	 * Name of the dead-letter queue this worker also consumes, so batches from it are
	 * recorded and acked here rather than dispatched.
	 */
	deadLetterQueue?: string;
	/**
	 * Forwards a message the dispatcher refused, already wrapped as `{ invalid: body }`.
	 * The dispatcher acks it either way — neither refusal survives a redelivery.
	 */
	onInvalid?: (message: Message<unknown>, body: InvalidMessage) => void | Promise<void>;
}

/** The registry both worker handlers run through. */
export interface JobDispatcher<Chain extends readonly AnyJobMiddleware[] = []> {
	/**
	 * Registers where a job's handler comes from.
	 * @param job The job, from the app's map.
	 * @param load A loader for its handler module, or the handler itself.
	 * @throws When this job's name is already mapped.
	 */
	map<Schema extends StandardSchemaV1 | undefined>(
		job: JobDefinition<Schema>,
		load: (() => Promise<{ default: JobHandler<Schema> }>) | JobHandler<Schema>,
	): void;
	/**
	 * Enqueues one message for a job.
	 * @param job The job, from the app's map.
	 * @param input The payload, typed by that job's own schema.
	 * @example await dispatcher.enqueue(jobs.checkHttp, { monitorId: monitor.id });
	 */
	enqueue<Schema extends StandardSchemaV1 | undefined>(
		job: JobDefinition<Schema>,
		...input: EnqueueArgs<Schema>
	): Promise<void>;
	/**
	 * Enqueues one message per input, in a single write. Enqueuing nothing does nothing.
	 * @param job The job, from the app's map.
	 * @param inputs One payload per message.
	 */
	enqueueMany<Schema extends StandardSchemaV1 | undefined>(
		job: JobDefinition<Schema>,
		inputs: EnqueueInput<Schema>[],
	): Promise<void>;
	/** Enqueues every mapped job this trigger is the schedule for. Runs none of them. */
	scheduled(controller: ScheduledController): Promise<void>;
	/** Runs every message in the batch, settling when all of them have. */
	queue(batch: MessageBatch<unknown>): Promise<void>;
	/** Every job with a handler, for asserting that a map has no leaf nobody runs. */
	readonly mapped: AnyJobDefinition[];
	/** The distinct schedules the mapped jobs declare, for asserting against a config. */
	readonly crons: string[];
	/** Type-only, carrying what the middleware chain installs. */
	readonly [chain]?: Chain | undefined;
}

/** Type-only slot carrying the dispatcher's middleware chain. */
declare const chain: unique symbol;

/** The context a dispatcher's handlers receive: the bare one, plus what its chain installs. */
export type JobDispatcherContext<Dispatcher> =
	Dispatcher extends JobDispatcher<infer Chain>
		? JobContext<unknown> & ChainProperties<Chain>
		: never;

/**
 * True for a handler `createJobHandler()` produced, false for a loader that
 * returns one. The job it carries is what tells the two callables apart.
 */
function isHandler(value: LoadHandler | AnyJobHandler | HandlerModule): value is AnyJobHandler {
	return typeof value === "function" && "job" in value;
}

/** Reads the `type` a body names, when it names one at all. */
function typeOf(body: unknown): string | undefined {
	if (typeof body !== "object" || body === null) return undefined;
	if (!("type" in body)) return undefined;
	return typeof body.type === "string" ? body.type : undefined;
}

/**
 * Builds the dispatcher both worker handlers delegate to.
 *
 * @param options The middleware, timeout, and queues this app's jobs run with.
 * @example export const dispatcher = createJobDispatcher({ middleware: [database()] });
 */
export function createJobDispatcher<const Chain extends readonly AnyJobMiddleware[] = []>(
	options: JobDispatcherOptions<Chain> = {},
): JobDispatcher<Chain> {
	let mapped = new Map<string, { job: AnyJobDefinition; load: LoadHandler | AnyJobHandler }>();
	/**
	 * Loads in flight or already done, keyed by job. The promise is cached rather than
	 * its result, so a batch whose messages dispatch together shares one import instead
	 * of racing several; a load that fails is dropped, leaving the next delivery to retry it.
	 */
	let resolved = new Map<string, Promise<RunnableJobHandler>>();

	/**
	 * Loads a job's handler, once per isolate. The loader is awaited only after a
	 * message has been matched and parsed, so nothing else pays for the module.
	 * @param name The job whose handler is wanted.
	 * @param load Its loader.
	 */
	function handlerFor(
		name: string,
		load: LoadHandler | AnyJobHandler,
	): Promise<RunnableJobHandler> {
		let cached = resolved.get(name);
		if (cached !== undefined) return cached;

		let loading = (async () => {
			let module = isHandler(load) ? load : await load();
			let handler = isHandler(module) ? module : module.default;

			/**
			 * The one place an app's handler becomes something this package calls. Its
			 * declared parameter is the context that app says its middleware installs;
			 * every call below runs that chain first, which is what makes it so.
			 */
			return handler as unknown as RunnableJobHandler;
		})().catch((error: unknown) => {
			resolved.delete(name);
			throw error;
		});

		resolved.set(name, loading);

		return loading;
	}

	/**
	 * Records a message the dispatcher will not dispatch, forwards it, and acks it.
	 * @param message The refused delivery.
	 * @param reason Which refusal this is.
	 */
	async function refuse(message: Message<unknown>, reason: RefusalReason): Promise<void> {
		let logger = new BatchedLogger(`job:refused:${message.id}`);

		logger.error("queue.invalid_message", {
			id: message.id,
			attempts: message.attempts,
			reason,
			body: message.body as JSONValue,
		});

		logger.flush();

		await options.onInvalid?.(message, { invalid: message.body });

		message.ack();
	}

	/**
	 * Records one dead-lettered message and acks it. That queue has no dead-letter
	 * queue of its own, so anything left unacked here would redeliver forever.
	 * @param message The dead-lettered delivery.
	 */
	function recordDeadLetter(message: Message<unknown>): void {
		let logger = new BatchedLogger(`job:dead-letter:${message.id}`);
		let body = message.body;

		try {
			/**
			 * A refused body arrives wrapped by `onInvalid`; one the platform gave up on
			 * arrives verbatim. `attempts` counts deliveries of this copy, not the retries
			 * that spent the original.
			 */
			if (typeof body === "object" && body !== null && "invalid" in body) {
				logger.error("job.dead_letter.invalid_message", {
					id: message.id,
					attempts: message.attempts,
					body: body.invalid as JSONValue,
				});
			} else {
				logger.error("job.dead_letter.retries_exhausted", {
					id: message.id,
					attempts: message.attempts,
					type: typeOf(body) ?? null,
					body: body as JSONValue,
				});
			}
		} finally {
			message.ack();
			logger.flush();
		}
	}

	/**
	 * Dispatches one message to the job it names.
	 * @param message The delivery.
	 * @param batchSize How many messages share this invocation.
	 */
	async function dispatch(message: Message<unknown>, batchSize: number): Promise<void> {
		let name = typeOf(message.body);
		let entry = name === undefined ? undefined : mapped.get(name);

		if (entry === undefined) return await refuse(message, "unknown-job");

		let input: unknown;

		if (entry.job.input !== undefined) {
			let result = await validate(message.body as JSONValue, entry.job.input);
			if (isFailure(result)) return await refuse(message, "invalid-input");
			input = result.data;
		}

		await runJob({
			job: entry.job,
			handler: () => handlerFor(entry.job.name, entry.load),
			message,
			input,
			batchSize,
			middleware: options.middleware ?? [],
			timeout: options.timeout,
			uptime: options.uptime,
		});
	}

	/**
	 * Hands bodies to the app's queue write.
	 * @param bodies The messages to enqueue.
	 * @throws When this dispatcher was built without a `send`.
	 */
	async function send(bodies: JSONValue[]): Promise<void> {
		if (options.send === undefined) {
			throw new Error("This dispatcher has no `send`, so it cannot enqueue anything");
		}

		if (bodies.length === 0) return;

		await options.send(bodies);
	}

	return {
		map(job, load) {
			if (mapped.has(job.name)) throw new Error(`Job "${job.name}" is already mapped`);
			mapped.set(job.name, { job, load: load as LoadHandler | AnyJobHandler });
		},

		get mapped() {
			return [...mapped.values()].map(({ job }) => job);
		},

		get crons() {
			let crons = new Set<string>();
			for (let { job } of mapped.values()) if (job.cron !== undefined) crons.add(job.cron);
			return [...crons];
		},

		async enqueue(job, ...input) {
			await send([messageBody(job, input[0])]);
		},

		async enqueueMany(job, inputs) {
			await send(inputs.map((input) => messageBody(job, input)));
		},

		async scheduled(controller) {
			let due = [...mapped.values()]
				.map(({ job }) => job)
				.filter((job) => job.cron === controller.cron);

			await send(due.map((job) => messageBody(job)));
		},

		async queue(batch) {
			if (options.deadLetterQueue !== undefined && batch.queue === options.deadLetterQueue) {
				for (let message of batch.messages) recordDeadLetter(message);
				return;
			}

			let outcomes = await Promise.allSettled(
				batch.messages.map((message) => dispatch(message, batch.messages.length)),
			);

			/**
			 * The first unexpected failure is re-thrown once every message has had its turn,
			 * so one job's crash reaches the platform without stopping its batch mates.
			 */
			for (let outcome of outcomes) if (outcome.status === "rejected") throw outcome.reason;
		},
	};
}
