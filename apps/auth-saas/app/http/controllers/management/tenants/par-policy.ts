/**
 * `POST /tenants/:tenantId/par-policy` — sets whether every client of the tenant must
 * start its authorization requests at the PAR endpoint (RFC 9126 §5), whatever the
 * client's own `requirePushedAuthorizationRequests` says.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { requireAbility } from "@sdxc/authz/middleware/router";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import { TENANT_PAR_POLICY_SET } from "~/app/http/openapi/tenants";
import { operationInputProblem } from "~/app/http/parse-body";
import abilities from "~/app/policies/abilities";
import routes from "~/routes/management";

/**
 * Builds the `tenantParPolicySet` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.tenantParPolicySet, createTenantParPolicySetAction(options));
 */
export function createTenantParPolicySetAction(options: ManagementControllerOptions) {
	return createAction(routes.tenantParPolicySet, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementTenant(options.resolveStub),
			managementRateLimit(options.limiter, { bucket: "write" }),
			requireAbility(abilities.tenant.parPolicy.set),
		],
		handler: async (ctx) => {
			let input = await TENANT_PAR_POLICY_SET.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);

			await ctx.tenantStub.setPushedAuthorizationRequestPolicy({
				required: input.data.body.required,
			});

			return new Response(null, { status: 204 });
		},
	});
}
