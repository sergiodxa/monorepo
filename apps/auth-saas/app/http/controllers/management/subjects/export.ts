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
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { operationInputProblem } from "~/app/http/lib/parse-body";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementIdempotency } from "~/app/http/middleware/management-idempotency";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import { SUBJECTS_EXPORT_BEGIN } from "~/app/http/openapi/subjects";
import TenantExportRun from "~/app/models/tenant-export-run";
import routes from "~/routes/management";

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
			managementTenant(options.resolveStub),
			managementIdempotency,
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx, "export:read");
			if (refused) return refused;

			let input = await SUBJECTS_EXPORT_BEGIN.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);

			let includeCredentials = input.data.body?.includeCredentials ?? false;

			if (includeCredentials) {
				let refusedCredentials = requireScope(ctx, "export:credentials");
				if (refusedCredentials) return refusedCredentials;
			}

			let tenantId = ctx.managementCaller.tenantId;
			let run = await TenantExportRun.create(ctx.db, { tenantId, includeCredentials });

			return json({ id: run.id, status: run.status }, { status: 201 });
		},
	});
}
