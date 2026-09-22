/**
 * `POST /tenants/:tenantId/mfa-policy` — sets whether every subject must
 * enroll a second factor to sign in, an existing tenant-object setting this
 * pass exposes over the management API alongside the tenant's control-plane
 * record.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { parseBody } from "~/app/http/lib/parse-body";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

let SetMfaPolicyBodySchema = s.object({ policy: s.enum_(["optional", "required"] as const) });

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
			let refused = requireScope(ctx.managementCaller, "tenant:write");
			if (refused) return refused;

			let parsed = parseBody(SetMfaPolicyBodySchema, await ctx.request.json().catch(() => null));
			if (!parsed.ok) return parsed.response;

			await ctx.tenantStub.setMfaPolicy({ policy: parsed.data.policy });

			return new Response(null, { status: 204 });
		},
	});
}
