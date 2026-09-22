/**
 * `GET /tenants/:tenantId/session-policy` — the effective session, idle and
 * refresh-token lifetimes this tenant currently enforces, which of the
 * platform default or the tenant's own customization each one currently
 * resolves to, and the platform bounds a caller may write within. Reading
 * carries no entitlement gate on any tier: a tenant asking what its own
 * session lifetimes are is asking about its own security posture, and the
 * answer is also the paid capability's own argument for itself, so a Free
 * tenant reads the same document a Pro tenant does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

/**
 * Builds the `tenantSessionPolicyDescribe` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.tenantSessionPolicyDescribe, createTenantSessionPolicyDescribeAction(options));
 */
export function createTenantSessionPolicyDescribeAction(options: ManagementControllerOptions) {
	return createAction(routes.tenantSessionPolicyDescribe, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementTenant(options.resolveStub),
			managementRateLimit(options.limiter, { bucket: "read" }),
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx.managementCaller, "tenant:write");
			if (refused) return refused;

			let result = await ctx.tenantStub.describeSessionPolicy({});
			let { cost: _cost, ...body } = result;

			return json(body, { status: 200 });
		},
	});
}
