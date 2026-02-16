import type { Message } from "@cloudflare/workers-types";
import type { JSONValue } from "@pkg/types";

import { BatchedLogger } from "@pkg/logger";
import { dasherize, underscore } from "inflected";

const UPTIME_URL = new URL("https://uptime.sergiodxa.com");

export namespace Job {
	export interface UptimeOptions {
		token: string;
		monitorId: string;
	}

	export interface ConstructorOptions {
		uptime?: UptimeOptions;
		logger: BatchedLogger;
	}

	export interface RunOptions<Body> extends Omit<ConstructorOptions, "logger"> {
		message: Message<Body>;
	}
}

export abstract class Job {
	static async run<T extends Job>(
		this: new (options: Job.ConstructorOptions, body: JSONValue) => T,
		options: Job.RunOptions<JSONValue>,
	): Promise<void> {
		let id = `job:${dasherize(underscore(this.name))}:${options.message.id}`;
		let job = new this({ ...options, logger: new BatchedLogger(id) }, options.message.body);

		try {
			job.logger.info("job.started", {
				id: options.message.id,
				attempts: options.message.attempts,
			});

			await job.perform();
			await job.uptime();

			options.message.ack();

			job.logger.info("job.completed", {
				id: options.message.id,
				attempts: options.message.attempts,
			});
		} catch (error) {
			if (error instanceof Job.RetryError) {
				job.logger.error("job.retrying", {
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
				job.logger.error("job.non-retriable", {
					id: options.message.id,
					attempts: options.message.attempts,
					error: {
						name: error instanceof Error ? error.name : "UnknownError",
						message: error instanceof Error ? error.message : String(error),
					},
				});

				return options.message.ack();
			}

			if (error instanceof Job.FetchError || error instanceof Job.NetworkError) {
				// use info level as this can be transient, we only want to know about it
				job.logger.info("job.uptime-failed", {
					error: {
						name: error instanceof Error ? error.name : "UnknownError",
						message: error instanceof Error ? error.message : String(error),
					},
					id: options.message.id,
					attempts: options.message.attempts,
				});

				// Don't retry on fetch errors, as they are likely to be transient issues with the uptime service
				return options.message.ack();
			}

			job.logger.error("job.failed", {
				id: options.message.id,
				attempts: options.message.attempts,
				error: {
					name: error instanceof Error ? error.name : "UnknownError",
					message: error instanceof Error ? error.message : String(error),
				},
			});

			throw error; // Let Cloudflare handle retries for unexpected errors
		} finally {
			job.logger.flush();
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
