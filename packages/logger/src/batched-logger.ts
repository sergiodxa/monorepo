import type { Log } from "./types";

/**
 * Batched logger that accumulates log entries and outputs them all at once when flushed.
 * Designed for Cloudflare Workers to consolidate all logs from a single execution context
 * (request, workflow, cron job, etc.) into one log entry.
 */
export class BatchedLogger {
	private events: Log.Entry[] = [];
	private readonly identifier: string;

	/**
	 * @param identifier - A string identifying the context (e.g., "POST /api/foo", "workflow:ping:abc123", "cron:daily-cleanup")
	 */
	constructor(identifier: string) {
		this.identifier = identifier;
	}

	/**
	 * Creates a BatchedLogger from a Request object.
	 * Convenience factory for HTTP request contexts.
	 */
	static fromRequest(request: Request): BatchedLogger {
		return new BatchedLogger(`${request.method} ${request.url}`);
	}

	info(event: string, payload?: Log.Payload) {
		this.events.push({
			level: "info",
			event,
			payload,
		});
	}

	error(event: string, payload?: Log.Payload) {
		this.events.push({
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
		if (this.events.length === 0) return;

		let hasError = this.events.some((e) => e.level === "error");

		let output = {
			timestamp: Date.now(),
			events: this.events.map(({ level, event, payload }) => ({
				level,
				event,
				...payload,
			})),
		};

		if (hasError) {
			console.error(this.identifier, output);
		} else {
			console.info(this.identifier, output);
		}

		this.events = [];
	}
}
