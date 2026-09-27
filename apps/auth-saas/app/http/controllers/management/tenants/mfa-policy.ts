/**
 * `POST /tenants/:tenantId/mfa-policy` — sets whether every subject must
 * enroll a second factor to sign in, an existing tenant-object setting this
 * pass exposes over the management API alongside the tenant's control-plane
 * record.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { operationInputProblem } from "~/app/http/lib/parse-body";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import { TENANT_MFA_POLICY_SET } from "~/app/http/openapi/tenants";
import routes from "~/routes/management";

/**
 * Builds the `tenantMfaPolicySet` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
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
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx, "tenant:write");
			if (refused) return refused;

			let input = await TENANT_MFA_POLICY_SET.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);

			await ctx.tenantStub.setMfaPolicy({ policy: input.data.body.policy });

			return new Response(null, { status: 204 });
		},
	});
}
