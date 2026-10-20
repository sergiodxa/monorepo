/**
 * `GET /tenants/:tenantId/subjects/import/:runId/download?ticket=...` — spends a
 * single-use download ticket and streams the report it named back as an
 * attachment.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { managementProblem } from "~/app/http/problem";
import { spendTransferDownloadTicket } from "~/app/models/transfer-storage";
import { recordCost } from "~/app/services/cost-ledger";
import routes from "~/routes/management";

/** A ticket that does not spend, or does not name the tenant this route's own path addresses. */
function invalidTicket(): Response {
	return managementProblem("invalidTicket", {
		detail: "This download link no longer works.",
	});
}

/** The report object a ticket named, gone from R2 despite the ticket having named it. */
function reportNotFound(): Response {
	return managementProblem("notFound", {
		detail: "This run's report is no longer available.",
	});
}

/**
 * Builds the `subjectsImportDownload` action, mounted with no auth
 * middleware of its own: the ticket in the query string is this route's
 * entire credential.
 *
 * @param options - The auth, rate-limit and tenant-stub options every management resource controller shares; only `r2` is read here.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.subjectsImportDownload, createSubjectsImportDownloadAction(options));
 */
export function createSubjectsImportDownloadAction(options: ManagementControllerOptions) {
	return createAction(routes.subjectsImportDownload, async (ctx) => {
		let tenantId = s.parse(s.object({ tenantId: s.string() }), ctx.params).tenantId;

		let ticket = ctx.url.searchParams.get("ticket");
		if (!ticket) return invalidTicket();

		let spent = await spendTransferDownloadTicket(ctx.db, { ticket });
		if (!spent.ok) return invalidTicket();
		if (spent.tenantId !== tenantId) return invalidTicket();

		let object = await options.r2.get(spent.r2Key);
		recordCost({ r2ClassBOperations: 1 });
		if (!object) return reportNotFound();

		return new Response(object.body, {
			status: 200,
			headers: {
				"Content-Type": "application/x-ndjson",
				"Content-Disposition": 'attachment; filename="import-report.ndjson"',
			},
		});
	});
}
