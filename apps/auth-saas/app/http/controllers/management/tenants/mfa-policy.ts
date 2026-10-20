/**
 * `POST /tenants/:tenantId/mfa-policy` — sets whether every subject must enroll a
 * second factor to sign in, an existing tenant-object setting this pass exposes
 * over the management API alongside the tenant's control-plane record.
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
import { TENANT_MFA_POLICY_SET } from "~/app/http/openapi/tenants";
import { operationInputProblem } from "~/app/http/parse-body";
import abilities from "~/app/policies/abilities";
import routes from "~/routes/management";

/**
 * Builds the `tenantMfaPolicySet` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.tenantMfaPolicySet, createTenantMfaPolicySetAction(options));
 */
export function createTenantMfaPolicySetAction(options: ManagementControllerOptions) {
	return createAction(routes.tenantMfaPolicySet, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementTenant(options.resolveStub),
			managementRateLimit(options.limiter, { bucket: "write" }),
			requireAbility(abilities.tenant.mfaPolicy.set),
		],
		handler: async (ctx) => {
			let input = await TENANT_MFA_POLICY_SET.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);

			await ctx.tenantStub.setMfaPolicy({ policy: input.data.body.policy });

			return new Response(null, { status: 204 });
		},
	});
}
