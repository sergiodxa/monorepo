/**
 * The worker's logging configuration, stated once and attached where every invocation
 * passes: the router's middleware chain and the job dispatcher. Every log opened through
 * it carries the same `service`, `environment`, `version`, sampler, and sink.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Sample } from "./sample.js";

import { Log } from "./log.js";

export namespace Logger {
	export interface Options {
		/** The worker's name, the same on every log it emits, so a query can group by it. */
		service: string;
		environment?: string;
		/** The deployed version, from the platform's version metadata when the worker binds it. */
		version?: string;
		/** Off unless given: every log is written. */
		sample?: Sample.Options;
		/** Defaults to the console. A test collects records here instead. */
		sink?: Log.Sink;
	}
}

/** A worker's logging configuration, and the way to open a log for a host with neither a router nor a dispatcher. */
export interface Logger {
	readonly options: Readonly<Logger.Options>;
	/**
	 * Opens a log carrying this configuration, for an entry point nothing else wraps.
	 *
	 * @param kind What kind of invocation it records.
	 * @param fields Fields known before any work runs.
	 * @example return logger.open("alarm", { tenant: { id } }).run(() => this.cleanup());
	 */
	open(kind: Log.Kind, fields?: Log.Fields): Log;
}

/**
 * Builds the configuration a worker hands to `log()` and to its job dispatcher.
 *
 * @param options What every log from this worker carries.
 * @example export const logger = createLogger({ service: "uptime", version: env.CF_VERSION_METADATA?.id });
 */
export function createLogger(options: Logger.Options): Logger {
	return {
		options,
		open(kind, fields) {
			return new Log({ ...options, kind }, fields);
		},
	};
}
