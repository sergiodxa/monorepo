/**
 * Admits a platform-router request only from a dashboard session naming a member of the
 * tenant the matched route's `:tenantId` names, and binds that member's role as
 * `ctx.access`, so a route's `requireAbility` decides the rest with JSON refusals.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { access } from "@sdxc/authz/middleware/router";
import { forbidden, unauthorized } from "@sdxc/http/response/json";
import { isFailure } from "@sdxc/result";

import {
	DashboardSignInRequiredError,
	resolveTenantMember,
} from "~/app/http/middleware/dashboard-session";
import policy from "~/app/policies/policy";

/**
 * Builds the member gate. Reads `:tenantId` off the matched route's own params, so it is
 * mounted on each tenant-scoped route itself rather than the router's global chain. A
 * subject outside the tenant and one refused an ability answer alike, so a refusal never
 * reveals whether a tenant id exists.
 *
 * @returns The middleware, for a route's own `middleware` array; it answers `401` with
 * no live session and `403` for a subject outside the tenant or refused an ability.
 * @example
 * createAction(routes.billing.portal, {
 * 	middleware: [dashboardAccess(), requireAbility(abilities.billing.manage)],
 * 	handler,
 * });
 */
export function dashboardAccess(): Middleware {
	return async (ctx, next) => {
		let tenantId = typeof ctx.params.tenantId === "string" ? ctx.params.tenantId : "";

		let member = await resolveTenantMember(ctx, tenantId);
		if (isFailure(member)) {
			if (member.error instanceof DashboardSignInRequiredError) {
				return unauthorized({ error: "sign_in_required" });
			}
			return forbidden({ error: "forbidden" });
		}

		let bind = access(policy, {
			roles: [member.data.role],
			onDenied: () => forbidden({ error: "forbidden" }),
		});
		return bind(ctx, next);
	};
}
