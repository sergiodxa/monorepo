/**
 * Test-only reader for what a request actually logged. The request logger batches a whole
 * request and flushes it to one console channel, so a test proving the level an event was
 * recorded at reads that level back out of the flushed entry itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One event as the request logger flushed it. */
export interface LoggedEvent {
	level: string;
	event: string;
	payload?: Record<string, unknown>;
}

/** The console channels a flush lands on, with the arguments every call carried. */
export interface FlushedLogs {
	error: unknown[][];
	info: unknown[][];
}

/**
 * Runs `work` with both console channels recorded, restoring them even when it throws, so
 * one failed assertion leaves the rest of a file logging where it expects to.
 *
 * @param work - The requests to record the logs of.
 * @returns What `work` returned, paired with everything it logged.
 */
export async function withLogs<T>(work: () => Promise<T>): Promise<[T, FlushedLogs]> {
	let logs: FlushedLogs = { error: [], info: [] };
	let original = { error: console.error, info: console.info };

	console.error = (...args: unknown[]) => void logs.error.push(args);
	console.info = (...args: unknown[]) => void logs.info.push(args);

	try {
		return [await work(), logs];
	} finally {
		console.error = original.error;
		console.info = original.info;
	}
}

/**
 * Every event a captured channel carried, whichever scope of the flushed entry it sat
 * under, so an assertion names the event and its level and stays free of that nesting.
 *
 * @param calls - One channel of a {@link withLogs} capture.
 */
export function loggedEvents(calls: unknown[][]): LoggedEvent[] {
	let found: LoggedEvent[] = [];

	function walk(node: unknown): void {
		if (Array.isArray(node)) {
			for (let item of node) walk(item);
			return;
		}

		if (node === null || typeof node !== "object") return;

		let record = node as Record<string, unknown>;

		if (typeof record.event === "string" && typeof record.level === "string") {
			found.push({
				level: record.level,
				event: record.event,
				payload: record.payload as Record<string, unknown> | undefined,
			});
		}

		for (let value of Object.values(record)) walk(value);
	}

	walk(calls);

	return found;
}
