/**
 * Admits a platform-router request only from a dashboard session holding one of the
 * given membership roles on the tenant the matched route's `:tenantId` names,
 * answering JSON refusals for routes that answer JSON themselves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { forbidden, unauthorized } from "@sdxc/http/response/json";
import { isFailure } from "@sdxc/result";

import type { MembershipRole } from "~/app/models/memberships";

import {
	DashboardSignInRequiredError,
	resolveTenantMember,
} from "~/app/http/middleware/dashboard-session";

/**
 * Builds the role gate. Reads `:tenantId` off the matched route's own params, so it
 * is mounted on each tenant-scoped route itself rather than the router's global
 * chain. A subject outside the tenant and one holding too low a role are refused
 * alike, so a refusal never reveals whether a tenant id exists.
 *
 * @param roles - The membership roles admitted.
 * @returns The middleware, for a route's own `middleware` array; it answers `401`
 * with no live session and `403` for anyone else not admitted.
 * @example
 * createAction(routes.billing.portal, { middleware: [dashboardRole("owner")], handler });
 */
export function dashboardRole(...roles: MembershipRole[]): Middleware {
	return async (ctx, next) => {
		let tenantId = typeof ctx.params.tenantId === "string" ? ctx.params.tenantId : "";

		let member = await resolveTenantMember(ctx, tenantId);
		if (isFailure(member)) {
			if (member.error instanceof DashboardSignInRequiredError) {
				return unauthorized({ error: "sign_in_required" });
			}
			return forbidden({ error: "forbidden" });
		}

		if (!roles.includes(member.data.role)) return forbidden({ error: "forbidden" });

		return next();
	};
}
