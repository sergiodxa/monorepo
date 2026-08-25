/**
 * The base class every queue consumer extends. It derives a stable kebab-case
 * identifier from the subclass name, runs `perform()` under a batched logger,
 * translates thrown errors into ack/retry decisions, and pings an uptime monitor
 * when the subclass declares one, so all jobs share one lifecycle and log shape.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Message } from "@cloudflare/workers-types";
import type { JSONValue } from "@pkg/types";

import { BatchedLogger } from "@pkg/logger";
import { dasherize, underscore } from "@pkg/strings";
import { ValidationError } from "@pkg/validate";

const UPTIME_URL = new URL("https://uptime.sergiodxa.com");

/**
 * The registered usage tracker, if the host app installed one. Module-level rather
 * than an option on `run()` so a worker's queue handler doesn't have to thread
 * instrumentation through every `Job.run(...)` call site.
 */
let usageTracker: Job.UsageTracker | undefined;

/**
 * Registers the tracker `Job.run` wraps every job in, enabling the `usage`
 * field on `job.completed`; pass `undefined` to turn it back off. Jobs run
 * untracked by default, and a misbehaving tracker only affects the job it wraps.
 * @param tracker Tracker that scopes an accumulator to one job's execution.
 * @example setJobUsageTracker((usage, body) => storage.run(usage, body));
 */
export function setJobUsageTracker(tracker: Job.UsageTracker | undefined): void {
	usageTracker = tracker;
}

/**
 * Renders a thrown `cause` that is not an `Error` as log text, serializing an
 * object so its fields reach the log intact instead of collapsing to
 * `[object Object]`, with the serialization guarded against a cause that cycles.
 * @param cause Value found on `error.cause`, of any shape.
 * @returns Text safe to place in the `message` field of a log entry.
 */
function describeCause(cause: unknown): string {
	if (typeof cause !== "object" || cause === null) return String(cause);
	try {
		return JSON.stringify(cause);
	} catch {
		return Object.prototype.toString.call(cause);
	}
}

export namespace Job {
	export interface UptimeOptions {
		token?: string;
		monitorId?: string;
	}

	/**
	 * Database work one job did, accumulated while it ran and reported on its
	 * `job.completed` event. Counters are mutated in place by the tracker
	 * registered through {@link setJobUsageTracker}, giving per-job-type attribution at no extra cost.
	 */
	export interface Usage {
		/** Statements executed. */
		statements: number;
		/** Rows read from tables and indexes. */
		rowsRead: number;
		/** Rows written to tables and indexes. */
		rowsWritten: number;
		/** Milliseconds the database reported for those statements, summed. */
		durationMs: number;
	}

	/**
	 * Runs `body` with `usage` as the active accumulator, so statements issued
	 * anywhere inside it attribute to this job, not a sibling job from the same
	 * queue batch; the host app owns the accumulation mechanism behind it.
	 */
	export type UsageTracker = <T>(
		usage: Usage,
		body: () => Promise<T>,
		context: UsageContext,
	) => Promise<T>;

	/**
	 * Which job a {@link UsageTracker} has been handed. An accumulator that only
	 * counts needs nothing from this; one that attributes needs the job's own
	 * identifier, sparing a caller from threading it through every `run()` call.
	 */
	export interface UsageContext {
		/** Stable kebab-case identifier for the job class, e.g. `check-http-job`. */
		job: string;
	}

	export interface ConstructorOptions {
		uptime?: UptimeOptions;
		logger: BatchedLogger;
	}

	export interface RunOptions extends Omit<ConstructorOptions, "logger" | "uptime"> {
		message: Message<unknown>;
		uptime?: string;
	}
}

export abstract class Job {
	static monitorId?: string;

	/**
	 * Runs one queued message through the job lifecycle: log start, `perform()`,
	 * uptime ping, then ack. `RetryError` retries, `NonRetriableError` and uptime
	 * failures ack, and anything else re-throws for the platform to retry.
	 *
	 * @param options - The queue message plus the optional uptime token
	 */
	static async run<T extends Job>(
		this: (new (options: Job.ConstructorOptions, body: JSONValue) => T) & { monitorId?: string },
		options: Job.RunOptions,
	): Promise<void> {
		let tracker = usageTracker;
		let identifier = dasherize(underscore(this.name));
		let usage: Job.Usage = { statements: 0, rowsRead: 0, rowsWritten: 0, durationMs: 0 };
		let run = () => Job.#lifecycle(this, identifier, options, tracker ? usage : undefined);

		if (!tracker) return await run();
		return await tracker(usage, run, { job: identifier });
	}

	/**
	 * The job lifecycle itself, split out of {@link Job.run} so it all runs inside
	 * the registered usage tracker's scope. Uptime ping failures log at info level
	 * and ack, treating the service's own hiccups as separate from the job's own outcome.
	 * @param constructor The `Job` subclass being run.
	 * @param identifier The subclass's kebab-case identifier, derived once by
	 * {@link Job.run} so the log id and the usage context cannot spell it two ways.
	 * @param options The queue message plus the optional uptime token.
	 * @param usage Live usage counters to report on `job.completed`, or `undefined`
	 * when nothing is tracking this job.
	 */
	static async #lifecycle<T extends Job>(
		constructor: (new (options: Job.ConstructorOptions, body: JSONValue) => T) & {
			monitorId?: string;
			name: string;
		},
		identifier: string,
		options: Job.RunOptions,
		usage: Job.Usage | undefined,
	): Promise<void> {
		let id = `job:${identifier}:${options.message.id}`;
		let uptime = { token: options.uptime, monitorId: constructor.monitorId };
		let logger = new BatchedLogger(id);

		let job = new constructor({ uptime, logger }, options.message.body as JSONValue);

		try {
			logger.info("job.started", {
				id: options.message.id,
				attempts: options.message.attempts,
			});

			await job.perform();
			await job.uptime();

			options.message.ack();

			logger.info("job.completed", {
				id: options.message.id,
				attempts: options.message.attempts,
				/** A snapshot copy, so the logged totals stay fixed once this event is written. */
				usage: usage ? { ...usage } : undefined,
			});
		} catch (error) {
			if (error instanceof Job.RetryError) {
				logger.error("job.retrying", {
					id: options.message.id,
					attempts: options.message.attempts,
					error: {
						name: error instanceof Error ? error.name : "UnknownError",
						message: error instanceof Error ? error.message : String(error),
					},
				});

				return options.message.retry();
			}

			if (error instanceof Job.NonRetriableError) {
				logger.error("job.non-retriable", {
					id: options.message.id,
					attempts: options.message.attempts,
					error: {
						name: error instanceof Error ? error.name : "UnknownError",
						message: error instanceof Error ? error.message : String(error),
						cause:
							error instanceof Error && error.cause
								? {
										name: error.cause instanceof Error ? error.cause.name : "UnknownError",
										message:
											error.cause instanceof Error
												? error.cause.message
												: describeCause(error.cause),
										issues: error.cause instanceof ValidationError ? error.cause.issues : undefined,
									}
								: undefined,
					},
				});

				return options.message.ack();
			}

			if (error instanceof Job.FetchError || error instanceof Job.NetworkError) {
				logger.info("job.uptime-failed", {
					error: {
						name: error instanceof Error ? error.name : "UnknownError",
						message: error instanceof Error ? error.message : String(error),
					},
					id: options.message.id,
					attempts: options.message.attempts,
				});

				return options.message.ack();
			}

			logger.error("job.failed", {
				id: options.message.id,
				attempts: options.message.attempts,
				error: {
					name: error instanceof Error ? error.name : "UnknownError",
					message: error instanceof Error ? error.message : String(error),
				},
			});

			throw error;
		} finally {
			logger.flush();
		}
	}

	readonly #opts: Job.ConstructorOptions;

	constructor(
		options: Job.ConstructorOptions,
		protected readonly input: JSONValue,
	) {
		this.#opts = options;
	}

	get logger() {
		return this.#opts.logger;
	}

	abstract perform(): Promise<void>;

	private async uptime() {
		if (this.#opts.uptime?.token === undefined || this.#opts.uptime?.monitorId === undefined) {
			return;
		}

		let monitorId = this.#opts.uptime.monitorId;

		let url = new URL(`/api/v1/cron-jobs/${monitorId}/ping`, UPTIME_URL);

		let headers = new Headers();
		headers.set("Authorization", `Bearer ${this.#opts.uptime.token}`);
		headers.set("Content-Type", "application/json");

		try {
			let response = await fetch(url, { method: "POST", headers: headers });
			if (response.ok) return;
			throw new Job.FetchError(response.status, await response.text());
		} catch (error) {
			if (error instanceof Job.FetchError) throw error;
			throw new Job.NetworkError("Failed to send ping to uptime service", {
				cause: error instanceof Error ? error : undefined,
			});
		}
	}

	private static NetworkError = class NetworkError extends Error {
		override name = "NetworkError";
	};

	private static FetchError = class FetchError extends Error {
		override name = "FetchError";
		constructor(status: number, body: string) {
			super(`Fetch failed with status ${status}: ${body}`);
		}
	};

	static RetryError = class RetryError extends Error {
		override name = "RetryError";
		constructor(message = "Failed to run job. Retry.", options?: ErrorOptions) {
			super(message, options);
		}
	};

	static NonRetriableError = class NonRetriableError extends Error {
		override name = "NonRetriableError";
		constructor(message = "Failed to run job. Not retriable.", options?: ErrorOptions) {
			super(message, options);
		}
	};
}
