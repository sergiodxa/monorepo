/**
 * `GET /tenants/:tenantId/subjects/import/:runId` — an import run's own
 * status and running counts, plus a fresh one-time download link for its
 * failure report once the run has finished and written one. A new ticket is
 * minted on every poll that has a report to offer rather than reused across
 * polls, since a ticket is single-use and cheap to mint, and reusing one
 * would leave it sitting unexpired but already handed out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import {
	importRunIdParam,
	importRunNotFound,
} from "~/app/http/controllers/management/subjects/shared";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { mintTransferDownloadTicket } from "~/app/lib/transfer-storage";
import TenantImportRun from "~/app/models/tenant-import-run";
import routes from "~/routes/management";

/**
 * Builds the `subjectsImportStatus` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.subjectsImportStatus, createSubjectsImportStatusAction(options));
 */
export function createSubjectsImportStatusAction(options: ManagementControllerOptions) {
	return createAction(routes.subjectsImportStatus, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementRateLimit(options.limiter, { bucket: "read" }),
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx, "subjects:read");
			if (refused) return refused;

			let runId = importRunIdParam(ctx);
			let run = await TenantImportRun.findById(ctx.db, runId);
			if (!run || run.tenant_id !== ctx.managementCaller.tenantId) return importRunNotFound();

			let body: Record<string, unknown> = {
				id: run.id,
				mode: run.mode,
				status: run.status,
				total: run.total,
				processed: run.processed,
				created: run.created,
				updated: run.updated,
				failed: run.failed,
			};

			if (run.status === "completed" && run.report_key !== null) {
				let ticket = await mintTransferDownloadTicket(ctx.db, {
					r2Key: run.report_key,
					tenantId: run.tenant_id,
				});

				let downloadPath = routes.subjectsImportDownload.href({
					tenantId: run.tenant_id,
					runId: run.id,
				});
				let downloadUrl = new URL(downloadPath, options.issuer);
				downloadUrl.searchParams.set("ticket", ticket);

				body.reportDownloadUrl = downloadUrl.toString();
			}

			return json(body, { status: 200 });
		},
	});
}
