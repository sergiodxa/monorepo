/**
 * The subject export run itself: for every tenant with a queued or running export,
 * pages its own directory through the tenant's own object, writes each page's rows
 * as NDJSON to R2, folds the progress into the run's control-plane counters, and —
 * once every subject has been read — closes the run out. A run that carries
 * password hashes mails the tenant's owners once, at the moment it starts rather
 * than once it finishes, since the notice is about a credentials export having
 * begun rather than about one having completed. One tick advances every active
 * run by as much as its own time and page budget allow, so a run resumes exactly
 * where the previous tick left it rather than restarting.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createJobHandler } from "@sdxc/jobs";
import { env } from "cloudflare:workers";

import jobs from "~/app/jobs";
import {
	BACKPRESSURE_DELAY_MS,
	BACKPRESSURE_THRESHOLD_MS,
	MAX_PAGES_PER_RUN_PER_TICK,
	PAGE_SIZE,
	TICK_TIME_BUDGET_MS,
} from "~/app/jobs/lib/subjects-export-pacing";
import { readTransferFileLines, writeTransferFile } from "~/app/lib/transfer-storage";
import { CredentialsExportStartedEmail } from "~/app/mail/credentials-export-started-email";
import { mailTranslator } from "~/app/mail/locale";
import { parseSenderAddress, tenantSenderAddress } from "~/app/mail/sender";
import Membership from "~/app/models/membership";
import TenantModel from "~/app/models/tenant";
import TenantExportRun from "~/app/models/tenant-export-run";

/** Awaits a plain delay; the one pause this job ever inserts is small enough that a local wrapper covers it. */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The R2 key a run's own output lives at, alongside the `imports/…` shape a source file arrives under. */
function outputKeyFor(run: { tenantId: string; runId: string }): string {
	return `exports/${run.tenantId}/${run.runId}.ndjson`;
}

/** Yields nothing — the output a run with no subjects at all still writes, so a finished export always has a file to name. */
async function* noLines(): AsyncGenerator<string> {}

/**
 * Appends newly-read rows to a run's output object, reading back whatever an
 * earlier tick already wrote first. An export can grow across many ticks over a
 * run that takes an hour, and each tick's own process exits with nothing held in
 * memory from the last one, so the object in R2 is the only place that growing
 * file can live between ticks.
 *
 * @param bucket - The R2 bucket the output lives in.
 * @param key - The output's object key.
 * @param newLines - This tick's own new rows, appended after whatever is already there.
 */
async function appendExportOutputLines(
	bucket: R2Bucket,
	key: string,
	newLines: string[],
): Promise<void> {
	let existing = await bucket.head(key);

	/**
	 * Streams the object's existing lines ahead of `newLines`, so the rewrite keeps
	 * every earlier tick's output rows.
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

export default createJobHandler(jobs.subjectsExport, async (ctx) => {
	let deadline = Date.now() + TICK_TIME_BUDGET_MS;
	let runs = await TenantExportRun.listActive(ctx.database);

	let runsAdvanced = 0;
	let runsFailed = 0;
	let runsCompleted = 0;
	let subjectsProcessed = 0;

	let platformFrom = parseSenderAddress(env.EMAIL_FROM);
	let platformTenant = ctx.tenant.getByName(env.PLATFORM_DOMAIN);

	for (let run of runs) {
		if (Date.now() >= deadline) break;

		let stub = ctx.tenant.getByName(run.tenant_id);

		if (run.status === "queued") {
			await TenantExportRun.markRunning(ctx.database, run.id);

			if (run.include_credentials) {
				let tenantRow = await TenantModel.findById(ctx.database, run.tenant_id);

				if (tenantRow) {
					let owners = (await Membership.listByTenant(ctx.database, run.tenant_id)).filter(
						(membership) => membership.role === "owner",
					);

					let { t } = mailTranslator();

					for (let owner of owners) {
						let described = await platformTenant.describeSubject({
							subjectId: owner.subject_id,
							audience: { kind: "admin" },
						});
						if (!described.ok) continue;

						let email = described.identifiers.find(
							(identifier) => identifier.kind === "email",
						)?.value;
						if (!email) continue;

						await ctx.mail.send(
							new CredentialsExportStartedEmail({ email, tenantName: tenantRow.name, t }),
							{ from: tenantSenderAddress(platformFrom, tenantRow.issuer) },
						);
					}
				}
			}
		}

		runsAdvanced++;

		let cursor = run.cursor;
		let reportKey = run.report_key;
		let exhausted = false;
		let refused = false;
		let pagesThisRun = 0;
		let tickOutputLines: string[] = [];

		while (true) {
			if (pagesThisRun >= MAX_PAGES_PER_RUN_PER_TICK) break;
			if (Date.now() >= deadline) break;

			let startedAt = Date.now();
			let page = await stub.exportSubjectPage({
				cursor,
				limit: PAGE_SIZE,
				includeCredentials: run.include_credentials,
			});
			let durationMs = Date.now() - startedAt;

			if (!page.ok) {
				refused = true;
				break;
			}

			for (let subjectRow of page.subjects) tickOutputLines.push(JSON.stringify(subjectRow));

			cursor = page.cursors.next;
			subjectsProcessed += page.subjects.length;
			pagesThisRun++;

			await TenantExportRun.advance(ctx.database, {
				id: run.id,
				cursor,
				processedDelta: page.subjects.length,
			});

			if (durationMs > BACKPRESSURE_THRESHOLD_MS) await sleep(BACKPRESSURE_DELAY_MS);

			if (cursor === null) {
				exhausted = true;
				break;
			}
		}

		if (tickOutputLines.length > 0) {
			if (reportKey === null) {
				reportKey = outputKeyFor({ tenantId: run.tenant_id, runId: run.id });
				await TenantExportRun.setReportKey(ctx.database, { id: run.id, reportKey });
			}

			await appendExportOutputLines(env.R2, reportKey, tickOutputLines);
		}

		if (refused) {
			await TenantExportRun.fail(ctx.database, run.id);
			runsFailed++;
			continue;
		}

		if (exhausted) {
			if (reportKey === null) {
				reportKey = outputKeyFor({ tenantId: run.tenant_id, runId: run.id });
				await writeTransferFile(env.R2, reportKey, noLines());
				await TenantExportRun.setReportKey(ctx.database, { id: run.id, reportKey });
			}

			await TenantExportRun.complete(ctx.database, run.id);
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
		subjects: { processed: subjectsProcessed },
	});
});
