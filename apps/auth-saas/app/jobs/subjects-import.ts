/**
 * The subject import run itself: for every tenant with a queued or running import,
 * reads its source file from R2 batch by batch, writes each batch through the
 * tenant's own object, folds the outcomes into the run's control-plane counters,
 * and — once a run's file is exhausted — writes its failure report, mints a
 * download ticket for it, and closes the run out. One tick advances every active
 * run by as much as its own time and batch budget allow, so a run resumes exactly
 * where the previous tick left it rather than restarting.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createJobHandler } from "@sdxc/jobs";
import { unwrap } from "@sdxc/result";
import { env } from "cloudflare:workers";

import type { ImportRowOutcome, ImportSubjectRow } from "~/database/subject-import";

import jobs from "~/app/jobs";
import {
	BACKPRESSURE_DELAY_MS,
	BACKPRESSURE_THRESHOLD_MS,
	BATCH_SIZE,
	MAX_BATCHES_PER_RUN_PER_TICK,
	TICK_TIME_BUDGET_MS,
} from "~/app/jobs/lib/subjects-import-pacing";
import { recordCost } from "~/app/lib/cost-ledger";
import { readTransferFileLines, writeTransferFile } from "~/app/lib/transfer-storage";

/** Awaits a plain delay; the one pause this job ever inserts is small enough that a local wrapper covers it. */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The R2 key a run's own failure report lives at, alongside the `imports/…` shape its source file arrives under. */
function reportKeyFor(run: { tenantId: string; runId: string }): string {
	return `reports/${run.tenantId}/${run.runId}.ndjson`;
}

/** One failing outcome, rendered as the NDJSON line its report echoes back to the customer. */
function toReportLine(outcome: Extract<ImportRowOutcome, { ok: false }>): string {
	return JSON.stringify({ externalId: outcome.externalId, problems: outcome.problems });
}

/**
 * Appends newly-failed lines to a run's report object, reading back whatever an
 * earlier tick already wrote first. A report can grow across many ticks over a
 * run that takes an hour, and each tick's own process exits with nothing held in
 * memory from the last one, so the object in R2 is the only place that growing
 * file can live between ticks.
 *
 * @param bucket - The R2 bucket the report lives in.
 * @param key - The report's object key.
 * @param newLines - This tick's own new failure lines, appended after whatever is already there.
 */
async function appendFailureReportLines(
	bucket: R2Bucket,
	key: string,
	newLines: string[],
): Promise<void> {
	let existing = await bucket.head(key);
	recordCost({ r2ClassBOperations: 1 });

	/**
	 * Streams the object's existing lines ahead of `newLines`, so the rewrite keeps
	 * every earlier tick's report lines.
	 *
	 * @yields Each existing line, then each of `newLines`, in order.
	 */
	async function* lines(): AsyncGenerator<string> {
		if (existing) {
			for await (let line of readTransferFileLines(bucket, key)) yield line;
		}
		for (let line of newLines) yield line;
	}

	await writeTransferFile(bucket, key, lines());
}

export default createJobHandler(jobs.subjectsImport, async (ctx) => {
	let deadline = Date.now() + TICK_TIME_BUDGET_MS;
	let runs = await ctx.models.tenantImportRuns.active().all();

	let runsAdvanced = 0;
	let runsFailed = 0;
	let runsCompleted = 0;
	let rowsProcessed = 0;

	for (let run of runs) {
		if (Date.now() >= deadline) break;

		let stub = ctx.tenant.getByName(run.tenant_id);

		if (run.status === "queued") {
			if (run.total !== null) {
				let began = await stub.beginImportRun({ estimatedRows: run.total });

				if (!began.ok) {
					unwrap(await ctx.models.tenantImportRuns.fail(run.id));
					runsFailed++;
					continue;
				}
			}

			unwrap(await ctx.models.tenantImportRuns.markRunning(run.id));
		}

		runsAdvanced++;

		let cursor = run.cursor;
		let reportKey = run.report_key;
		let sourceExhausted = false;
		let batchesThisRun = 0;

		let batchRows: ImportSubjectRow[] = [];
		let batchMalformed: ImportRowOutcome[] = [];
		let batchLineCount = 0;
		let tickFailureLines: string[] = [];

		/** Sends the accumulated batch, folds its outcomes into the run's counters, and paces the next one. */
		async function flushBatch(): Promise<void> {
			if (batchLineCount === 0) return;

			let startedAt = Date.now();
			let rpcOutcomes: ImportRowOutcome[] =
				batchRows.length > 0
					? (await stub.importSubjects({ mode: run.mode, rows: batchRows })).outcomes
					: [];
			let durationMs = Date.now() - startedAt;

			let outcomes = [...batchMalformed, ...rpcOutcomes];
			let createdDelta = outcomes.filter((outcome) => outcome.ok).length;
			let failedDelta = outcomes.length - createdDelta;

			for (let outcome of outcomes) {
				if (!outcome.ok) tickFailureLines.push(toReportLine(outcome));
			}

			cursor += batchLineCount;
			rowsProcessed += batchLineCount;

			unwrap(
				await ctx.models.tenantImportRuns.advance({
					id: run.id,
					cursor,
					processedDelta: batchLineCount,
					createdDelta,
					updatedDelta: 0,
					failedDelta,
				}),
			);

			batchRows = [];
			batchMalformed = [];
			batchLineCount = 0;
			batchesThisRun++;

			if (durationMs > BACKPRESSURE_THRESHOLD_MS) await sleep(BACKPRESSURE_DELAY_MS);
		}

		let iterator = readTransferFileLines(env.R2, run.source_key, { startLine: cursor })[
			Symbol.asyncIterator
		]();

		try {
			while (true) {
				if (batchesThisRun >= MAX_BATCHES_PER_RUN_PER_TICK) break;
				if (Date.now() >= deadline) break;

				let next = await iterator.next();

				if (next.done) {
					sourceExhausted = true;
					break;
				}

				try {
					batchRows.push(JSON.parse(next.value) as ImportSubjectRow);
				} catch {
					batchMalformed.push({ ok: false, problems: [{ kind: "row", reason: "invalid-json" }] });
				}

				batchLineCount++;

				if (batchLineCount >= BATCH_SIZE) await flushBatch();
			}
		} finally {
			if (!sourceExhausted) await iterator.return?.(undefined);
		}

		if (sourceExhausted && batchLineCount > 0) await flushBatch();

		if (tickFailureLines.length > 0) {
			if (reportKey === null) {
				reportKey = reportKeyFor({ tenantId: run.tenant_id, runId: run.id });
				unwrap(await ctx.models.tenantImportRuns.setReportKey(run.id, reportKey));
			}

			await appendFailureReportLines(env.R2, reportKey, tickFailureLines);
		}

		if (sourceExhausted) {
			let final = await ctx.models.tenantImportRuns.find(run.id);

			// A download ticket is single-use and its plaintext exists only at the
			// moment it is minted — minting one here, with no request waiting to
			// carry it anywhere, would create a row nobody could ever spend. The
			// route that answers "where can I download this run's report" mints
			// its own ticket on demand from `run.report_key` when a customer
			// actually asks for one.

			await stub.completeImportRun({
				processed: final?.processed ?? 0,
				created: final?.created ?? 0,
				failed: final?.failed ?? 0,
			});
			unwrap(await ctx.models.tenantImportRuns.complete(run.id));
			runsCompleted++;
		}
	}

	ctx.log.set({
		runs: {
			active: runs.length,
			advanced: runsAdvanced,
			completed: runsCompleted,
			failed: runsFailed,
		},
		rows: { processed: rowsProcessed },
	});
});
