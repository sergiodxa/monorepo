import type { Log } from "./types";

export namespace BatchedLogger {
	export type Event = {
		level: Log.Level;
		event: string;
		[key: string]: unknown;
	};
}

/**
 * Batched logger that accumulates log entries and outputs them all at once when flushed.
 * Designed for Cloudflare Workers to consolidate all logs from a single execution context
 * (request, workflow, cron job, etc.) into one log entry.
 */
export class BatchedLogger {
	/**
	 * Creates a BatchedLogger from a Request object.
	 * Convenience factory for HTTP request contexts.
	 */
	static fromRequest(request: Request): BatchedLogger {
		return new BatchedLogger(`${request.method} ${request.url}`);
	}

	private entries = new Set<Log.Entry>();

	/**
	 * @param identifier - A string identifying the context (e.g., "POST /api/foo", "workflow:ping:abc123", "cron:daily-cleanup")
	 */
	constructor(private readonly identifier: string) {}

	info(event: string, payload?: Log.Payload) {
		this.entries.add({
			level: "info",
			event,
			payload,
		});
	}

	error(event: string, payload?: Log.Payload) {
		this.entries.add({
			level: "error",
			event,
			payload,
		});
	}

	/**
	 * Flushes all accumulated log entries to console as a single log call.
	 * Uses console.error if any error is present, otherwise console.info.
	 * Clears the internal buffer after flushing.
	 */
	flush() {
		if (this.entries.size === 0) return;

		let output = { timestamp: Date.now(), events: this.events };

		if (this.hasError) console.error(this.identifier, output);
		else console.info(this.identifier, output);

		this.entries.clear();
	}

	private get hasError() {
		for (let entry of this.entries) {
			if (entry.level === "error") return true;
		}

		return false;
	}

	private get events() {
		let events: BatchedLogger.Event[] = [];

		for (let entry of this.entries) {
			events.push({ level: entry.level, event: entry.event, ...entry.payload });
		}

		return events;
	}
}
