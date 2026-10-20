/**
 * `GET /tenants/:tenantId/subjects/export/:runId` — an export run's own status and
 * running counts, plus a fresh one-time download link for its output once the run
 * has finished and written one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { requireAbility } from "@sdxc/authz/middleware/router";
import { json } from "@sdxc/http/response";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import {
	exportRunIdParam,
	exportRunNotFound,
} from "~/app/http/controllers/management/subjects/shared";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { mintTransferDownloadTicket } from "~/app/models/transfer-storage";
import abilities from "~/app/policies/abilities";
import routes from "~/routes/management";

/**
 * Builds the `subjectsExportStatus` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every management resource controller shares.
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
			requireAbility(abilities.subjects.export.status),
		],
		handler: async (ctx) => {
			let runId = exportRunIdParam(ctx);
			let run = await ctx.models.tenantExportRuns.find(runId);
			if (!run || run.tenant_id !== ctx.managementCaller.tenantId) return exportRunNotFound();

			let body: Record<string, unknown> = {
				id: run.id,
				includeCredentials: run.include_credentials,
				status: run.status,
				total: run.total,
				processed: run.processed,
			};

			let canDownload =
				!run.include_credentials || ctx.access.can(abilities.subjects.export.credentials);

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
