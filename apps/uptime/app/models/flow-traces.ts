/**
 * Chrome DevTools Performance traces for flow monitor runs: upload to
 * R2 after a check, download for a team member, and delete after seven days.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";
import type { FileStorage } from "remix/file-storage";

import { DAY_MS } from "@sdxc/dates/zone";
import { R2FileStorage } from "@sdxc/file-storage-r2";
import { env } from "cloudflare:workers";
import { getTableName } from "remix/data-table";

import type { BatchedSweepResult } from "~/app/services/retention";

import { recordCost } from "~/app/services/cost";
import { RETENTION_BATCH_SIZE, RETENTION_MAX_BATCHES } from "~/app/services/retention";
import { flowMonitorResults, flowMonitors } from "~/database/schema";

/** How long a trace object is kept in R2 before CleanJob deletes it. */
export const FLOW_TRACE_RETENTION_DAYS = 7;

/** Content type every stored chrome://tracing JSON is written with. */
const TRACE_CONTENT_TYPE = "application/json";

/**
 * The R2 store for flow Performance traces. Tests pass their own {@link FileStorage}.
 */
export function flowTraces(storage: FileStorage = new R2FileStorage(env.FLOW_TRACES)): FileStorage {
	return storage;
}

/**
 * Object key for one result's trace. Team and monitor prefixes keep a listing
 * scoped when the clean job pages the bucket.
 */
export function flowTraceKey(teamId: string, monitorId: string, resultId: string): string {
	return `flow-traces/${teamId}/${monitorId}/${resultId}.json`;
}

/**
 * Store one Performance timeline and return the key written.
 *
 * @param storage - The R2-backed (or in-memory) store.
 * @param key - {@link flowTraceKey} for this result.
 * @param json - The chrome://tracing JSON text.
 */
export async function storeFlowTrace(
	storage: FileStorage,
	key: string,
	json: string,
): Promise<string> {
	let file = new File([json], key.split("/").pop() ?? "trace.json", {
		type: TRACE_CONTENT_TYPE,
		lastModified: Date.now(),
	});
	await storage.set(key, file);
	/** PutObject is an R2 Class A operation; deletes are free and are not recorded. */
	recordCost("r2ClassAOperations");
	return key;
}

/**
 * Read a stored trace as bytes, or `null` when it has expired or was never written.
 */
export async function readFlowTrace(storage: FileStorage, key: string): Promise<Uint8Array | null> {
	let file = await storage.get(key);
	/** GetObject is an R2 Class B operation whether or not the key still holds an object. */
	recordCost("r2ClassBOperations");
	if (file === null) return null;
	return new Uint8Array(await file.arrayBuffer());
}

/** Remove one trace object; missing keys succeed. R2 deletes are free. */
export async function deleteFlowTrace(storage: FileStorage, key: string): Promise<void> {
	await storage.remove(key);
}

/** One expired result whose R2 object the clean job still has to drop. */
interface ExpiredTraceRow {
	id: string;
	traceKey: string;
}

/**
 * Deletes R2 Performance traces older than {@link FLOW_TRACE_RETENTION_DAYS} and
 * nulls `trace_key` on those result rows so the download control disappears. The
 * result row itself keeps its longer history window.
 *
 * @param db - Database holding `flow_monitor_results`.
 * @param storage - The R2 (or in-memory) store the keys point at.
 * @param now - The run's single instant, so cutoff and logging agree.
 */
export async function deleteExpiredFlowTraces(
	db: Database,
	storage: FileStorage,
	now: number = Date.now(),
): Promise<BatchedSweepResult> {
	let cutoff = now - FLOW_TRACE_RETENTION_DAYS * DAY_MS;
	let results = getTableName(flowMonitorResults);
	let selectSql =
		`SELECT \`id\` AS id, \`trace_key\` AS traceKey FROM ${results} ` +
		`WHERE \`trace_key\` IS NOT NULL AND \`checked_at\` < ? LIMIT ?`;

	let rowsAffected = 0;
	let batches = 0;

	while (batches < RETENTION_MAX_BATCHES) {
		let page = await db.exec(selectSql, [cutoff, RETENTION_BATCH_SIZE]);
		let rows = (page.rows ?? []) as unknown as ExpiredTraceRow[];
		batches += 1;

		if (rows.length === 0) {
			return { rowsAffected, batches, reachedCeiling: false };
		}

		for (let row of rows) {
			await deleteFlowTrace(storage, row.traceKey);
		}

		let placeholders = rows.map(() => "?").join(", ");
		await db.exec(
			`UPDATE ${results} SET \`trace_key\` = NULL WHERE \`id\` IN (${placeholders})`,
			rows.map((row) => row.id),
		);

		rowsAffected += rows.length;
		if (rows.length < RETENTION_BATCH_SIZE) {
			return { rowsAffected, batches, reachedCeiling: false };
		}
	}

	return { rowsAffected, batches, reachedCeiling: true };
}

/** One yesterday flow run that still has a downloadable Performance trace. */
export interface DigestFlowTrace {
	/** Flow monitor id, for the download URL. */
	monitorId: string;
	/** Name the team gave the monitor. */
	monitorName: string;
	/** Result row id, for the download URL. */
	resultId: string;
}

/**
 * Flow runs on `[since, until)` that still have an R2 Performance trace, newest
 * first. The daily digest lists these so a member knows a report is ready.
 *
 * @param db - Database handle.
 * @param teamId - Team whose flows to report.
 * @param since - Inclusive start of the window, as epoch ms.
 * @param until - Exclusive end of the window, as epoch ms.
 */
export async function listDigestFlowTraces(
	db: Database,
	teamId: string,
	since: number,
	until: number,
): Promise<DigestFlowTrace[]> {
	let results = getTableName(flowMonitorResults);
	let monitors = getTableName(flowMonitors);
	let page = await db.exec(
		`SELECT r.\`id\` AS resultId, r.\`flow_monitor_id\` AS monitorId, m.\`name\` AS monitorName
		   FROM ${results} r
		   JOIN ${monitors} m ON m.\`id\` = r.\`flow_monitor_id\`
		  WHERE m.\`team_id\` = ?
		    AND r.\`trace_key\` IS NOT NULL
		    AND r.\`checked_at\` >= ?
		    AND r.\`checked_at\` < ?
		  ORDER BY r.\`checked_at\` DESC, r.\`id\` DESC`,
		[teamId, since, until],
	);

	return (page.rows ?? []) as unknown as DigestFlowTrace[];
}
