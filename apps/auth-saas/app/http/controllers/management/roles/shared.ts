/**
 * What every route in this directory shares: reading the `:roleId` path
 * param, the `problem+json` response for a role or permission the tenant
 * does not hold, and the entitlement refusal defining or changing one is
 * gated behind.
 *
 * A permission key is read from a query parameter rather than a path
 * segment: `remix/route-pattern` treats a raw `.` as a structural delimiter
 * within a dynamic segment, and a permission key such as `billing.view`
 * carries one as ordinary data.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";

import { managementProblem } from "~/app/http/lib/problem";

/** Parses and requires the `:roleId` path param every single-role route matches. */
export function roleIdParam(ctx: { params: Record<string, string | undefined> }): string {
	return s.parse(s.object({ roleId: s.string() }), ctx.params).roleId;
}

/** A role the tenant does not hold at the given scope, for a route naming one in its path. */
export function roleNotFound(): Response {
	return managementProblem("notFound", {
		detail: "No such role exists.",
	});
}

/** A permission the tenant has not declared, for a route naming one in its query. */
export function permissionNotFound(): Response {
	return managementProblem("notFound", {
		detail: "No such permission exists.",
	});
}

/** A caller defining or changing a role or permission against a plan this tenant is not entitled to. */
export function rolesEntitlementRequired(): Response {
	return managementProblem("entitlementRequired", {
		detail:
			"This tenant is not entitled to custom roles and permissions. Defining or changing a role or permission is not included on this tenant's plan.",
	});
}
