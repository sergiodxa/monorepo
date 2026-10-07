/**
 * `POST /tenants/:tenantId/session-policy` — writes a partial update to the
 * five knobs governing this tenant's own session, idle and refresh-token
 * lifetimes, gated on the paid entitlement that sells the ability to shorten
 * the platform defaults to a number a tenant's own compliance obligation
 * names. A field left out of the body leaves that column untouched.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { SetSessionPolicyResult } from "~/database/tenant-do";

import { operationInputProblem } from "~/app/http/lib/parse-body";
import { managementProblem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementEntitlement } from "~/app/http/middleware/management-entitlement";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import { TENANT_SESSION_POLICY_SET } from "~/app/http/openapi/tenants";
import routes from "~/routes/management";

/** A caller whose tenant's plan does not include customizing session lifetimes. */
function sessionPolicyNotEntitled(): Response {
	return managementProblem("entitlementRequired", {
		detail: "This tenant is not entitled to customize its session policy on its current plan.",
	});
}

/** Maps a `setSessionPolicy` refusal onto the same `problem+json` validation failure a refused body answers with. */
function setSessionPolicyFailure(result: Extract<SetSessionPolicyResult, { ok: false }>): Response {
	return managementProblem("validationFailed", {
		detail: "The request body did not pass validation.",
		extensions: {
			errors: [{ pointer: `/policy/${result.field}`, code: "invalid", message: result.message }],
		},
	});
}

/**
 * Builds the `tenantSessionPolicySet` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.tenantSessionPolicySet, createTenantSessionPolicySetAction(options));
 */
export function createTenantSessionPolicySetAction(options: ManagementControllerOptions) {
	return createAction(routes.tenantSessionPolicySet, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementTenant(options.resolveStub),
			managementRateLimit(options.limiter, { bucket: "write" }),
			...managementEntitlement("session_policy", sessionPolicyNotEntitled),
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx, "tenant:write");
			if (refused) return refused;

			let input = await TENANT_SESSION_POLICY_SET.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);

			let result = await ctx.tenantStub.setSessionPolicy({
				policy: input.data.body.policy,
				actor: ctx.managementCaller.actor,
			});
			if (!result.ok) return setSessionPolicyFailure(result);

			return json(
				{ policy: result.policy, sessionsShortened: result.sessionsShortened },
				{ status: 200 },
			);
		},
	});
}
