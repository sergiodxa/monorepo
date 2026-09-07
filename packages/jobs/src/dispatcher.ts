/**
 * `createJobDispatcher()`, which pairs handlers with the jobs an app declared and owns
 * both worker handlers. A cron delivery enqueues and never handles; a queue delivery
 * finds the job its message names, parses the body against that job's own schema,
 * and only then loads the handler, so an isolate serving requests never parses one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { Logger } from "@sdxc/logger";
import type { JSONValue } from "@sdxc/types";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { Schedule } from "@sdxc/cron";
import { Log } from "@sdxc/logger";
import { isFailure, unwrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";

import type { JobContext } from "./context.js";
import type { AnyJobHandler, JobHandler, RunnableJobHandler } from "./handler.js";
import type { CronExpression } from "./job.js";
import type { AnyJobDefinition, EnqueueArgs, EnqueueInput, JobDefinition } from "./jobs.js";
import type { OnJobEnd } from "./lifecycle.js";
import type { AnyJobMiddleware, ChainProperties } from "./middleware.js";
import type { DeadLetterReason, JobDelivery, JobMessage, JobQueue, Settlement } from "./queue.js";

import { openJobLog } from "./context.js";
import { readMessageBody } from "./jobs.js";
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
 * What a refused message's log fails with, so its record ends `error` and names the
 * refusal as its `error.type` the way a run's ending names the class it threw.
 */
class Refused extends Error {
	override name = "Job.Refused";

	constructor(reason: RefusalReason) {
		super(
			reason === "unknown-job"
				? "Message names no job this dispatcher maps."
				: "Message body failed the job's schema.",
		);
	}
}

/** What a dead-lettered message's log fails with, for the same reason a refusal has one. */
class DeadLettered extends Error {
	override name = "Job.DeadLettered";

	constructor(reason: DeadLetterReason) {
		super(
			reason === "invalid_message"
				? "A refused message reached the dead-letter queue."
				: "Message exhausted its retries.",
		);
	}
}

/** What a dispatcher needs beyond the handlers mapped onto it. */
export interface JobDispatcherOptions<Chain extends readonly AnyJobMiddleware[] = []> {
	/**
	 * The worker's logging configuration. Every cron, queue, and job log this dispatcher
	 * opens carries it; without one they carry no service.
	 */
	logger?: Logger;
	/**
	 * The queue this dispatcher enqueues through. A dispatcher without one can still run
	 * what a backend delivers, and refuses to enqueue.
	 */
	queue?: JobQueue;
	/** Runs around every job, in the order declared. Prefer an inline array. */
	middleware?: Chain;
	/** How long a job gets before its `ctx.signal` aborts and the dispatcher stops waiting. */
	timeout?: DurationInput;
	/**
	 * Runs once a delivery's ending is decided and before it is settled, which is what makes
	 * it the place for work that has to reach a service before the message is acked.
	 *
	 * Its failure is never the job's: anything it throws is recorded on that run's own log
	 * and the ending settles as decided. It runs after the middleware chain has unwound, so
	 * a value some middleware installed may already be disposed — anything needing a live
	 * dependency belongs in that middleware's own `finally`.
	 *
	 * @example
	 * async onEnd(ctx, status) {
	 * 	if (status.type !== "done") return;
	 * 	let sweep = ctx.of(jobs.cleanExpiredSessions);
	 * 	if (sweep !== null) await uptime(sweep.meta.monitorId);
	 * }
	 */
	onEnd?: OnJobEnd;
	/**
	 * Name of the dead-letter queue this worker also consumes, so batches from it are
	 * recorded and acked here rather than dispatched.
	 */
	deadLetterQueue?: string;
	/**
	 * Forwards a message the dispatcher refused, already wrapped as `{ invalid: body }`.
	 * The dispatcher settles it either way — neither refusal survives a redelivery.
	 */
	onInvalid?: (delivery: JobDelivery, body: InvalidMessage) => void | Promise<void>;
	/**
	 * How many attempts a message gets before it is dead-lettered, for a queue whose
	 * `retries` are this package's to count. Ignored by a backend that counts its own.
	 */
	maxAttempts?: number;
}

/** The registry both worker handlers run through. */
export interface JobDispatcher<Chain extends readonly AnyJobMiddleware[] = []> {
	/**
	 * Registers where a job's handler comes from.
	 * @param job The job, from the app's map.
	 * @param load A loader for its handler module, or the handler itself.
	 * @throws When this job's name is already mapped.
	 */
	map<Schema extends StandardSchemaV1 | undefined, Meta>(
		job: JobDefinition<Schema, Meta>,
		load: (() => Promise<{ default: JobHandler<Schema, Meta> }>) | JobHandler<Schema, Meta>,
	): void;
	/**
	 * Enqueues one message for a job.
	 * @param job The job, from the app's map.
	 * @param input The payload, typed by that job's own schema.
	 * @example await dispatcher.enqueue(jobs.checkHttp, { monitorId: monitor.id });
	 */
	enqueue<Schema extends StandardSchemaV1 | undefined, Meta>(
		job: JobDefinition<Schema, Meta>,
		...input: EnqueueArgs<Schema>
	): Promise<void>;
	/**
	 * Enqueues one message per input, in a single write. Enqueuing nothing does nothing.
	 * @param job The job, from the app's map.
	 * @param inputs One payload per message.
	 */
	enqueueMany<Schema extends StandardSchemaV1 | undefined, Meta>(
		job: JobDefinition<Schema, Meta>,
		inputs: EnqueueInput<Schema>[],
	): Promise<void>;
	/**
	 * Runs the job one delivery names, whatever handed it over.
	 * @param delivery The message, already read off the backend.
	 * @param batchSize How many deliveries share this invocation. Defaults to one.
	 * @returns What the delivery ended as, for the caller to apply.
	 */
	deliver(delivery: JobDelivery, batchSize?: number): Promise<Settlement>;
	/**
	 * Runs every delivery that arrived together, inside one `queue` log, settling each
	 * through `apply` as it finishes rather than when the last one does.
	 *
	 * @param deliveries The deliveries this invocation carries.
	 * @param options Where they came from, and how to settle each.
	 * @throws The first unexpected failure, once every delivery has had its turn.
	 */
	deliverBatch(
		deliveries: JobDelivery[],
		options: {
			/** The queue they were read from, for the record and for recognising a dead letter. */
			queue?: string;
			apply: (delivery: JobDelivery, settlement: Settlement) => void;
		},
	): Promise<void>;
	/**
	 * Enqueues every mapped job that is due, and runs none of them.
	 *
	 * @param options The minute being ticked, and the one schedule to limit it to.
	 * @example await dispatcher.tick({ now: new Date(), only: controller.cron });
	 */
	tick(options: { now: Date; only?: CronExpression }): Promise<void>;
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

/**
 * A message body as one field. Fields are scalars, so the body a message could not be
 * dispatched with is kept as its JSON — the one thing worth reading back about it.
 * @param body The delivered body, of whatever shape.
 */
function bodyField(body: unknown): string | undefined {
	try {
		return JSON.stringify(body);
	} catch {
		return Object.prototype.toString.call(body);
	}
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
	 * Opens the log one worker invocation is recorded in, carrying the worker's
	 * configuration when the dispatcher was given one.
	 * @param kind Which invocation it records.
	 * @param fields What is known before any work runs.
	 */
	function open(kind: Log.Kind, fields: Log.Fields): Log {
		return options.logger?.open(kind, fields) ?? new Log({ kind }, fields);
	}

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
	 * Records a delivery the dispatcher will not dispatch as a `job` log that ended `refused`,
	 * forwards it, and answers with the settlement that takes it out of the queue.
	 * @param delivery The refused delivery.
	 * @param reason Which refusal this is.
	 */
	async function refuse(delivery: JobDelivery, reason: RefusalReason): Promise<Settlement> {
		let log = openJobLog({
			job: {
				name: readMessageBody(delivery.body).job,
				id: delivery.id,
				attempts: delivery.attempts,
				ending: "refused",
				refusal: reason,
				body: bodyField(delivery.body),
			},
		});

		log.fail(new Refused(reason));
		log.parent?.inc("jobs.refused");
		log.emit();

		await options.onInvalid?.(delivery, { invalid: delivery.body });

		return { type: "dead-letter", reason: "invalid_message" };
	}

	/**
	 * Records one dead-lettered message as a `job` log that ended `dead_letter`, and acks
	 * it. That queue has no dead-letter queue of its own, so anything left unacked here
	 * would redeliver forever.
	 *
	 * A refused body arrives wrapped by `onInvalid`; one the platform gave up on arrives
	 * verbatim. `attempts` counts deliveries of this copy, not the retries that spent the
	 * original.
	 *
	 * @param delivery The dead-lettered delivery.
	 */
	function recordDeadLetter(delivery: JobDelivery): void {
		let body = delivery.body;
		let wrapped: InvalidMessage | undefined =
			typeof body === "object" && body !== null && "invalid" in body
				? (body as InvalidMessage)
				: undefined;
		let reason: DeadLetterReason = wrapped === undefined ? "retries_exhausted" : "invalid_message";
		let payload = wrapped === undefined ? body : wrapped.invalid;

		let log = openJobLog({
			job: {
				name: readMessageBody(payload).job,
				id: delivery.id,
				attempts: delivery.attempts,
				ending: "dead_letter",
				dead_letter: reason,
				body: bodyField(payload),
			},
		});

		log.fail(new DeadLettered(reason));
		log.parent?.inc("jobs.dead_lettered");
		log.emit();
	}

	/**
	 * Runs the job one delivery names, answering with what it ended as.
	 * @param delivery The delivery, already read off the backend.
	 * @param batchSize How many deliveries share this invocation.
	 */
	async function deliver(delivery: JobDelivery, batchSize: number): Promise<Settlement> {
		let { job: name, payload } = readMessageBody(delivery.body);
		let entry = name === undefined ? undefined : mapped.get(name);

		if (entry === undefined) return await refuse(delivery, "unknown-job");

		if (exhausted(delivery)) return { type: "dead-letter", reason: "retries_exhausted" };

		let input: unknown;

		if (entry.job.input !== undefined) {
			let result = await validate(payload as JSONValue, entry.job.input);
			if (isFailure(result)) return await refuse(delivery, "invalid-input");
			input = result.data;
		}

		return await runJob({
			job: entry.job,
			handler: () => handlerFor(entry.job.name, entry.load),
			delivery,
			input,
			batchSize,
			middleware: options.middleware ?? [],
			timeout: options.timeout,
			onEnd: options.onEnd,
		});
	}

	/**
	 * Hands messages to the queue this dispatcher writes through, raising the backend's own
	 * failure so a caller that cannot enqueue hears about it.
	 *
	 * @param messages The messages to enqueue.
	 * @throws When this dispatcher was built without a `queue`, or the backend refused.
	 */
	async function send(messages: JobMessage[]): Promise<void> {
		if (options.queue === undefined) {
			throw new Error("This dispatcher has no `queue`, so it cannot enqueue anything");
		}

		if (messages.length === 0) return;

		unwrap(await options.queue.send(messages));
	}

	/**
	 * Whether this delivery has spent the attempts this package allows it. False for a queue
	 * that counts its own, whatever `maxAttempts` says, so nothing overrules a backend policy.
	 *
	 * @param delivery The delivery about to run.
	 */
	function exhausted(delivery: JobDelivery): boolean {
		if (options.queue?.retries !== "core") return false;
		if (options.maxAttempts === undefined) return false;
		return delivery.attempts > options.maxAttempts;
	}

	/**
	 * The jobs one tick enqueues: those declaring the trigger's own expression when the tick
	 * names one, and otherwise those whose schedule fires in this minute.
	 *
	 * @param now The minute being ticked.
	 * @param only The single expression the platform delivered, when a platform did.
	 */
	function due(now: Date, only: CronExpression | undefined): AnyJobDefinition[] {
		let jobs = [...mapped.values()].map(({ job }) => job);

		if (only !== undefined) return jobs.filter((job) => job.cron === only);

		return jobs.filter((job) => {
			if (job.cron === undefined) return false;
			let schedule = Schedule.parse(job.cron);
			return isFailure(schedule) ? false : schedule.data.matches(now, { timeZone: "UTC" });
		});
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

		async deliver(delivery, batchSize = 1) {
			return await deliver(delivery, batchSize);
		},

		async enqueue(job, ...input) {
			await send([{ job: job.name, body: input[0] as JSONValue }]);
		},

		async enqueueMany(job, inputs) {
			await send(inputs.map((input) => ({ job: job.name, body: input as JSONValue })));
		},

		async tick({ now, only }) {
			let log = open("cron", {
				cron: { expression: only, scheduled_at: now.getTime() },
			});

			await log.run(async () => {
				let jobs = due(now, only);

				await send(jobs.map((job) => ({ job: job.name })));

				log.set({ jobs: { enqueued: jobs.length } });
			});
		},

		async deliverBatch(deliveries, { queue, apply }) {
			let log = open("queue", {
				queue: { name: queue, batch_size: deliveries.length },
			});

			await log.run(async () => {
				if (options.deadLetterQueue !== undefined && queue === options.deadLetterQueue) {
					for (let delivery of deliveries) {
						recordDeadLetter(delivery);
						apply(delivery, { type: "ack" });
					}
					return;
				}

				let outcomes = await Promise.allSettled(
					deliveries.map(async (delivery) => {
						apply(delivery, await deliver(delivery, deliveries.length));
					}),
				);

				/**
				 * The first unexpected failure is re-thrown once every delivery has had its turn,
				 * so one job's crash reaches the platform without stopping its batch mates.
				 */
				for (let outcome of outcomes) if (outcome.status === "rejected") throw outcome.reason;
			});
		},
	};
}
