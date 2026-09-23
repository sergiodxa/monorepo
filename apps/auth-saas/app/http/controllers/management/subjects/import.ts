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
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { managementProblem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { writeTransferFile } from "~/app/lib/transfer-storage";
import TenantImportRun from "~/app/models/tenant-import-run";
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

/**
 * Reads an NDJSON request body one line at a time, decoding and buffering
 * exactly the way {@link readTransferFileLines} reads a finished object back,
 * so a source file this route writes reads back identically either way.
 * Calls `onLine` once per non-empty row as it is yielded, so a caller
 * streaming these lines straight into R2 counts them in the same pass rather
 * than reading the file twice.
 */
async function* readRequestBodyLines(
	body: ReadableStream<Uint8Array>,
	onLine: () => void,
): AsyncGenerator<string> {
	let buffer = "";
	let decoder = new TextDecoder();
	let reader = body.getReader();

	try {
		while (true) {
			let { done, value } = await reader.read();
			if (value) buffer += decoder.decode(value, { stream: true });

			let newlineIndex = buffer.indexOf("\n");
			while (newlineIndex !== -1) {
				let line = buffer.slice(0, newlineIndex);
				buffer = buffer.slice(newlineIndex + 1);

				if (line.length > 0) {
					onLine();
					yield line;
				}

				newlineIndex = buffer.indexOf("\n");
			}

			if (done) break;
		}

		buffer += decoder.decode();
		if (buffer.length > 0) {
			onLine();
			yield buffer;
		}
	} finally {
		reader.releaseLock();
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
			let refused = requireScope(ctx.managementCaller, "subjects:write");
			if (refused) return refused;

			let mode = ctx.url.searchParams.get("mode");
			if (!isImportMode(mode)) return invalidMode();

			let body = ctx.request.body;
			if (!body) return emptySourceFile();

			let tenantId = ctx.managementCaller.tenantId;
			let sourceKey = `imports/${tenantId}/${crypto.randomUUID()}.ndjson`;

			let total = 0;
			await writeTransferFile(
				options.r2,
				sourceKey,
				readRequestBodyLines(body, () => total++),
			);

			if (total === 0) {
				await options.r2.delete(sourceKey);
				return emptySourceFile();
			}

			let run = await TenantImportRun.create(ctx.db, { tenantId, mode, sourceKey });
			run = await TenantImportRun.setTotal(ctx.db, { id: run.id, total });

			return json({ id: run.id, status: run.status, total: run.total }, { status: 201 });
		},
	});
}
