/**
 * Batched logger that accumulates log entries per execution context and
 * flushes them as a single console call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Log } from "./types.js";

export namespace Logger {
	export interface Event {
		level: Log.Level;
		event: string;
		[key: string]: unknown;
	}

	export interface Output {
		timestamp: number;
		events: Event[];
	}
}

/**
 * Batched logger that accumulates log entries and outputs them all at once when flushed.
 * Designed for Cloudflare Workers to consolidate all logs from a single execution context
 * (request, workflow, cron job, etc.) into one log entry.
 */
export class Logger {
	/**
	 * Uses the request's method and URL as the logger's identifier so
	 * batched output can be traced back to the request that produced it.
	 */
	static fromRequest(request: Request): Logger {
		return new Logger(`${request.method} ${request.url}`);
	}

	#entries = new Set<Log.Entry>();
	#identifier: string;

	/**
	 * @param identifier - A string identifying the context (e.g., "POST /api/foo", "workflow:ping:abc123", "cron:daily-cleanup")
	 */
	constructor(identifier: string) {
		this.#identifier = identifier;
	}

	info(event: string, payload?: Log.Payload) {
		this.#entries.add({ level: "info", event, payload });
	}

	error(event: string, payload?: Log.Payload) {
		this.#entries.add({ level: "error", event, payload });
	}

	get events(): Logger.Event[] {
		let events: Logger.Event[] = [];

		for (let entry of this.#entries) {
			events.push({ level: entry.level, event: entry.event, ...entry.payload });
		}

		return events;
	}

	get hasEvents(): boolean {
		return this.#entries.size > 0;
	}

	get hasError(): boolean {
		for (let entry of this.#entries) {
			if (entry.level === "error") return true;
		}

		return false;
	}

	toJSON(): Logger.Output {
		return {
			timestamp: performance.now(),
			events: this.events,
		};
	}

	/**
	 * Flushes all accumulated log entries to console as a single log call.
	 * Uses console.error if any error is present, otherwise console.info.
	 * Clears the internal buffer after flushing.
	 */
	flush() {
		if (!this.hasEvents) return;

		if (this.hasError) console.error(this.#identifier, this.toJSON());
		else console.info(this.#identifier, this.toJSON());

		this.#entries.clear();
	}
}
