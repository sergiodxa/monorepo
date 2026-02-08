import { createContext, type RouterContextProvider } from "react-router";

type LogPayload = Record<string, unknown>;

type LogLevel = "info" | "error";

type LogEntry = {
	level: LogLevel;
	event: string;
	payload?: LogPayload;
};

/**
 * Immediate logger that outputs each log call directly to console.
 * Use this for non-request contexts like cron jobs or entry.server.tsx error handling.
 */
export class Logger {
	private createLogData(event: string, payload?: LogPayload) {
		return { ...payload, event, timestamp: Date.now() };
	}

	info(event: string, payload?: LogPayload) {
		console.info(this.createLogData(event, payload));
	}

	error(event: string, payload?: LogPayload) {
		console.error(this.createLogData(event, payload));
	}
}

/**
 * Singleton instance of Logger for immediate logging outside of request context.
 */
export let logger = new Logger();

/**
 * Batched logger that accumulates log entries and outputs them all at once when flushed.
 * Designed for Cloudflare Workers to consolidate all logs from a single execution context
 * (request, workflow, cron job, etc.) into one log entry.
 */
export class BatchedLogger {
	private events: LogEntry[] = [];
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

	info(event: string, payload?: LogPayload) {
		this.events.push({
			level: "info",
			event,
			payload,
		});
	}

	error(event: string, payload?: LogPayload) {
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

/**
 * React Router context for storing the BatchedLogger instance per request.
 */
export const LoggerContext = createContext<BatchedLogger>();

/**
 * Creates a middleware that provides a BatchedLogger instance for each request.
 * The logger is stored in the React Router context and automatically flushed after the handler completes.
 */
export function createLoggerMiddleware() {
	return async function loggerMiddleware(
		{ context, request }: { context: RouterContextProvider; request: Request },
		next: () => Promise<Response>,
	) {
		let logger = BatchedLogger.fromRequest(request);
		context.set(LoggerContext, logger);

		try {
			return await next();
		} finally {
			logger.flush();
		}
	};
}

/**
 * Retrieves the BatchedLogger instance from the React Router context.
 * Must be called within a request that has the logger middleware active.
 */
export function getLoggerFromContext(
	context: RouterContextProvider | Readonly<RouterContextProvider>,
): BatchedLogger {
	let logger = context.get(LoggerContext);
	if (!logger) {
		throw new Error("Logger not found in context. Did you forget to add loggerMiddleware?");
	}
	return logger;
}
