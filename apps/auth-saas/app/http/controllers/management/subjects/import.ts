/**
 * `POST /tenants/:tenantId/subjects/import?mode=validate|apply` — begins a
 * subject import run. The request body IS the NDJSON source file: it streams
 * straight to R2 while this route counts its own rows in the same pass, so
 * the run it queues always carries a real declared total, closing the gap
 * where the cron job's own storage-ceiling check has nothing to project
 * against. There is no separate "get an upload URL" step, since this route
 * is the only caller a signed-upload mechanism would ever serve.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import * as JSONL from "@sdxc/jsonl";
import { isFailure, unwrap } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementProblem } from "~/app/http/problem";
import { requireScope } from "~/app/http/require-scope";
import { writeTransferFile } from "~/app/models/transfer-storage";
import routes from "~/routes/management";

/** Narrows a `mode` query value to the two modes an import run accepts. */
function isImportMode(value: string | null): value is "validate" | "apply" {
	return value === "validate" || value === "apply";
}

/** A `problem+json` refusal for a missing or unrecognized `mode` query parameter. */
function invalidMode(): Response {
	return managementProblem("validationFailed", {
		extensions: {
			errors: [
				{
					pointer: "/mode",
					code: "invalid",
					message: 'The "mode" query parameter is required and must be "validate" or "apply".',
				},
			],
		},
	});
}

/** A `problem+json` refusal for a source file with no rows to import. */
function emptySourceFile(): Response {
	return managementProblem("validationFailed", {
		detail: "The uploaded file carries no rows to import.",
		extensions: { errors: undefined },
	});
}

/** The longest row an uploaded source file may carry, bounding what one line buffers in the Worker. */
const MAX_IMPORT_LINE_BYTES = 1_048_576;

/** A `problem+json` refusal naming the source file's row that exceeds {@link MAX_IMPORT_LINE_BYTES}. */
function lineTooLong(error: JSONL.JSONLError): Response {
	return managementProblem("validationFailed", {
		detail: `Line ${error.line} of the uploaded file is longer than ${MAX_IMPORT_LINE_BYTES} bytes.`,
		extensions: { errors: undefined },
	});
}

/**
 * The rows of an NDJSON request body, each yielded as its raw text so the
 * stored source file keeps the uploaded bytes of every row. Calls `onLine`
 * once per row, so a caller streaming them into R2 counts them in the same
 * pass, and ends at a row over {@link MAX_IMPORT_LINE_BYTES}, handing its
 * failure to `onError`.
 *
 * @yields Each non-blank NDJSON line of the body, in order.
 */
async function* readRequestBodyLines(
	body: ReadableStream<Uint8Array>,
	onLine: () => void,
	onError: (error: JSONL.JSONLError) => void,
): AsyncGenerator<string> {
	for await (let line of JSONL.lines(body, { maxLineBytes: MAX_IMPORT_LINE_BYTES })) {
		if (isFailure(line)) {
			onError(line.error);
			return;
		}
		onLine();
		yield line.data.text;
	}
}

/**
 * Builds the `subjectsImportBegin` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.subjectsImportBegin, createSubjectsImportBeginAction(options));
 */
export function createSubjectsImportBeginAction(options: ManagementControllerOptions) {
	return createAction(routes.subjectsImportBegin, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementRateLimit(options.limiter, { bucket: "import_export" }),
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx, "subjects:write");
			if (refused) return refused;

			let mode = ctx.url.searchParams.get("mode");
			if (!isImportMode(mode)) return invalidMode();

			let body = ctx.request.body;
			if (!body) return emptySourceFile();

			let tenantId = ctx.managementCaller.tenantId;
			let sourceKey = `imports/${tenantId}/${generateUUID()}.ndjson`;

			let total = 0;
			let tooLong: JSONL.JSONLError | undefined;
			await writeTransferFile(
				options.r2,
				sourceKey,
				readRequestBodyLines(
					body,
					() => total++,
					(error) => {
						tooLong = error;
					},
				),
			);

			if (tooLong) {
				await options.r2.delete(sourceKey);
				return lineTooLong(tooLong);
			}

			if (total === 0) {
				await options.r2.delete(sourceKey);
				return emptySourceFile();
			}

			let run = unwrap(
				await ctx.models.tenantImportRuns.create({
					tenant_id: tenantId,
					mode,
					source_key: sourceKey,
				}),
			);
			run = unwrap(await ctx.models.tenantImportRuns.update(run.id, { total }));

			return json({ id: run.id, status: run.status, total: run.total }, { status: 201 });
		},
	});
}
