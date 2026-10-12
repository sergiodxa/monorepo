/**
 * Test-only reader for what a request actually recorded. The router joins whatever log is
 * current when it runs, so a test opens one around its requests and reads back the record
 * the app wrote into it — outcome, fields and notes — once the work has settled.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Log } from "@sdxc/logger";

/** One emitted record: flat scalar fields under dotted keys, plus the `notes` array. */
export type LogRecord = Readonly<Record<string, unknown>>;

/**
 * Runs `work` inside a request log and returns what it recorded. Every request `work`
 * sends joins the same log, so a helper's set-up requests belong outside the call and
 * only the request under test inside it.
 *
 * @param work - The requests to record.
 * @returns What `work` returned, paired with the record it produced.
 */
export async function withLog<T>(work: () => Promise<T>): Promise<[T, LogRecord]> {
	let records: LogRecord[] = [];
	let log = new Log({ kind: "request", sink: (record) => void records.push(record) });

	let result = await log.run(work);

	return [result, records[0]!];
}

/**
 * The breadcrumbs a record carries, so an assertion names the note, its level and the
 * fields written alongside it. An empty list for a record that wrote none.
 *
 * @param record - A record from {@link withLog}.
 */
export function notesOf(record: LogRecord): Log.Note[] {
	let notes = record.notes;
	return Array.isArray(notes) ? (notes as Log.Note[]) : [];
}
