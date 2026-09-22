/**
 * `GET /tenants/:tenantId/subjects/export/:runId` — an export run's own
 * status and running counts, plus a fresh one-time download link for its
 * output once the run has finished and written one. A new ticket is minted
 * on every poll that has output to offer, the same way the import status
 * route mints one on every poll that has a report, rather than reused across
 * polls.
 *
 * Reading a run's status and counts never needs `export:credentials`, even
 * for a run that itself carries password hashes — knowing a run exists and
 * how far it has gotten is not the same as being able to read the hashes it
 * may carry. That gate belongs at the one place credentials actually become
 * reachable: this route mints a download ticket for a credentials-bearing
 * run's output only for a caller who currently holds `export:credentials`,
 * so a ticket for such a run is never handed to a caller who could not have
 * begun that run in the first place. `export:read` alone still sees the
 * run's status and counts, just without a `exportDownloadUrl` in the body.
 * The download route itself stays exactly as ticket-only as import's own —
 * mounted with no bearer auth of its own — because by the time a ticket
 * exists at all, it was only ever minted for a caller already cleared to
 * hold it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import {
	exportRunIdParam,
	exportRunNotFound,
} from "~/app/http/controllers/management/subjects/shared";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { mintTransferDownloadTicket } from "~/app/lib/transfer-storage";
import TenantExportRun from "~/app/models/tenant-export-run";
import routes from "~/routes/management";

/**
 * Builds the `subjectsExportStatus` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.subjectsExportStatus, createSubjectsExportStatusAction(options));
 */
export function createSubjectsExportStatusAction(options: ManagementControllerOptions) {
	return createAction(routes.subjectsExportStatus, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementRateLimit(options.limiter, { bucket: "read" }),
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx.managementCaller, "export:read");
			if (refused) return refused;

			let runId = exportRunIdParam(ctx);
			let run = await TenantExportRun.findById(ctx.db, runId);
			if (!run || run.tenant_id !== ctx.managementCaller.tenantId) return exportRunNotFound();

			let body: Record<string, unknown> = {
				id: run.id,
				includeCredentials: run.include_credentials,
				status: run.status,
				total: run.total,
				processed: run.processed,
			};

			let canDownload =
				!run.include_credentials ||
				requireScope(ctx.managementCaller, "export:credentials") === null;

			if (run.status === "completed" && run.report_key !== null && canDownload) {
				let ticket = await mintTransferDownloadTicket(ctx.db, {
					r2Key: run.report_key,
					tenantId: run.tenant_id,
				});

				let downloadPath = routes.subjectsExportDownload.href({
					tenantId: run.tenant_id,
					runId: run.id,
				});
				let downloadUrl = new URL(downloadPath, options.issuer);
				downloadUrl.searchParams.set("ticket", ticket);

				body.exportDownloadUrl = downloadUrl.toString();
			}

			return json(body, { status: 200 });
		},
	});
}
