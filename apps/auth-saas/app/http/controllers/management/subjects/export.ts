/**
 * `POST /tenants/:tenantId/subjects/export` — begins a subject export run. Unlike
 * import, this route has no file to stream: the request body carries only the one
 * flag that shapes what the run will carry, `includeCredentials`, so it is parsed
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { requireAbility } from "@sdxc/authz/middleware/router";
import { json } from "@sdxc/http/response";
import { isFailure, unwrap } from "@sdxc/result";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { managementAuth, managementDenied } from "~/app/http/middleware/management-auth";
import { managementIdempotency } from "~/app/http/middleware/management-idempotency";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import { SUBJECTS_EXPORT_BEGIN } from "~/app/http/openapi/subjects";
import { operationInputProblem } from "~/app/http/parse-body";
import abilities from "~/app/policies/abilities";
import routes from "~/routes/management";

/**
 * Builds the `subjectsExportBegin` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every management resource controller shares.
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
			requireAbility(abilities.subjects.export.begin),
		],
		handler: async (ctx) => {
			let input = await SUBJECTS_EXPORT_BEGIN.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);

			let includeCredentials = input.data.body?.includeCredentials ?? false;

			if (includeCredentials) {
				let credentials = ctx.access.check(abilities.subjects.export.credentials);
				if (!credentials.allowed) return managementDenied(ctx, credentials);
			}

			let tenantId = ctx.managementCaller.tenantId;
			let run = unwrap(
				await ctx.models.tenantExportRuns.create({
					tenant_id: tenantId,
					include_credentials: includeCredentials,
				}),
			);

			return json({ id: run.id, status: run.status }, { status: 201 });
		},
	});
}
