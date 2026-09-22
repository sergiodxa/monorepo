/**
 * `POST /tenants/:tenantId/subjects/export` — begins a subject export run.
 * Unlike import, this route has no file to stream: the request body carries
 * only the one flag that shapes what the run will carry, `includeCredentials`,
 * so it is parsed as a small JSON body the same way `set-session-policy.ts`
 * parses its own body-only write, rather than a query parameter.
 *
 * `export:read` alone begins a run that leaves out password hashes.
 * Asking for `includeCredentials: true` additionally requires
 * `export:credentials`, checked and refused on its own rather than folded
 * into a silent downgrade to `false` — a caller who asked for credentials and
 * did not get them needs to know that, not receive a run that quietly
 * carries less than it asked for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { parseBody } from "~/app/http/lib/parse-body";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import TenantExportRun from "~/app/models/tenant-export-run";
import routes from "~/routes/management";

let SubjectsExportBeginBodySchema = s.object({
	includeCredentials: s.optional(s.boolean()),
});

/**
 * Builds the `subjectsExportBegin` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.subjectsExportBegin, createSubjectsExportBeginAction(options));
 */
export function createSubjectsExportBeginAction(options: ManagementControllerOptions) {
	return createAction(routes.subjectsExportBegin, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementRateLimit(options.limiter, { bucket: "import_export" }),
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx.managementCaller, "export:read");
			if (refused) return refused;

			let raw = await ctx.request.json().catch(() => ({}));
			let parsed = parseBody(SubjectsExportBeginBodySchema, raw);
			if (!parsed.ok) return parsed.response;

			let includeCredentials = parsed.data.includeCredentials ?? false;

			if (includeCredentials) {
				let refusedCredentials = requireScope(ctx.managementCaller, "export:credentials");
				if (refusedCredentials) return refusedCredentials;
			}

			let tenantId = ctx.managementCaller.tenantId;
			let run = await TenantExportRun.create(ctx.db, { tenantId, includeCredentials });

			return json({ id: run.id, status: run.status }, { status: 201 });
		},
	});
}
