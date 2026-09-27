/**
 * `POST /tenants/:tenantId/subjects/:subjectId/password/force-reset` — marks
 * a subject's current password as owing a change and revokes every session
 * it holds, for a targeted response to a suspected compromise.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { ForcePasswordResetResult } from "~/database/passwords";

import { subjectIdParam, subjectNotFound } from "~/app/http/controllers/management/subjects/shared";
import { parseBody } from "~/app/http/lib/parse-body";
import { managementProblem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

let ForcePasswordResetBodySchema = s.object({ reason: s.string() });

/** Maps every `forcePasswordReset` refusal onto its own `problem+json` response. */
function forcePasswordResetFailure(
	result: Exclude<ForcePasswordResetResult, { ok: true }>,
): Response {
	if (result.reason === "not-found") return subjectNotFound();

	return managementProblem("noPassword");
}

/**
 * Builds the `passwordForceReset` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.passwordForceReset, createPasswordForceResetAction(options));
 */
export function createPasswordForceResetAction(options: ManagementControllerOptions) {
	return createAction(routes.passwordForceReset, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementTenant(options.resolveStub),
			managementRateLimit(options.limiter, { bucket: "write" }),
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx, "subjects:write");
			if (refused) return refused;

			let subjectId = subjectIdParam(ctx);

			let parsed = parseBody(
				ForcePasswordResetBodySchema,
				await ctx.request.json().catch(() => null),
			);
			if (!parsed.ok) return parsed.response;

			let result = await ctx.tenantStub.forcePasswordReset({
				subjectId,
				reason: parsed.data.reason,
			});
			if (!result.ok) return forcePasswordResetFailure(result);

			return json({ passwordId: result.passwordId, reason: result.reason }, { status: 200 });
		},
	});
}
