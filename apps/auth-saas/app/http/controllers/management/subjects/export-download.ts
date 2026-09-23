/**
 * `GET /tenants/:tenantId/subjects/export/:runId/download?ticket=...` —
 * spends a single-use download ticket and streams the export output it
 * named back as an attachment. The ticket is the whole authorization for
 * this route, mounted with no management auth of its own: it was minted
 * from a status poll, and — for a run that carries password hashes — only
 * ever minted for a caller who held `export:credentials` at that moment, so
 * a ticket for such a run already proves the credentials gate was checked
 * upstream. It still carries the tenant it was minted for, and this route
 * checks that tenant against the `:tenantId` its own path names before it
 * streams anything, so a ticket minted for one tenant can never be honored
 * against another tenant's URL even though the ticket alone already
 * authorizes the download.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { managementProblem } from "~/app/http/lib/problem";
import { spendTransferDownloadTicket } from "~/app/lib/transfer-storage";
import routes from "~/routes/management";

/** A ticket that does not spend, or does not name the tenant this route's own path addresses. */
function invalidTicket(): Response {
	return managementProblem("invalidTicket", {
		detail: "This download link no longer works.",
	});
}

/** The export object a ticket named, gone from R2 despite the ticket having named it. */
function reportNotFound(): Response {
	return managementProblem("notFound", {
		detail: "This run's output is no longer available.",
	});
}

/**
 * Builds the `subjectsExportDownload` action, mounted with no auth
 * middleware of its own: the ticket in the query string is this route's
 * entire credential.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares; only `r2` is read here.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.subjectsExportDownload, createSubjectsExportDownloadAction(options));
 */
export function createSubjectsExportDownloadAction(options: ManagementControllerOptions) {
	return createAction(routes.subjectsExportDownload, async (ctx) => {
		let tenantId = s.parse(s.object({ tenantId: s.string() }), ctx.params).tenantId;

		let ticket = ctx.url.searchParams.get("ticket");
		if (!ticket) return invalidTicket();

		let spent = await spendTransferDownloadTicket(ctx.db, { ticket });
		if (!spent.ok) return invalidTicket();
		if (spent.tenantId !== tenantId) return invalidTicket();

		let object = await options.r2.get(spent.r2Key);
		if (!object) return reportNotFound();

		return new Response(object.body, {
			status: 200,
			headers: {
				"Content-Type": "application/x-ndjson",
				"Content-Disposition": 'attachment; filename="subjects-export.ndjson"',
			},
		});
	});
}
