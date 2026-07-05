/**
 * Middleware factory that gates mutating (non-safe) tenant requests behind a set of
 * allowed roles, while letting read-only requests through so `viewer` members retain
 * read access. Must run after `tenantOwner`, which populates `context.tenant.role`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { forbidden } from "@pkg/http/response/html";

import type { TenantMemberRole } from "~/app/models/tenant-member";

import middleware from "~/app/lib/middleware";

/** A tenant role permitted to act, including the tenant owner. */
type AllowedRole = "owner" | TenantMemberRole;

/** Requests that never mutate tenant state and are readable by any member. */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Requires the current user's tenant role to be one of `allowed` for mutating
 * (non-safe) requests. Read-only requests pass through so `viewer` members keep read
 * access. Must run after `tenantOwner`, which resolves `context.tenant.role`.
 *
 * Mutations sent as `POST` with a `_method` override are still non-safe, so they are
 * enforced regardless of whether the override has been applied yet.
 * @param allowed - Roles permitted to perform the mutation.
 * @returns Middleware enforcing the role for mutating requests.
 * @example
 * router.map(route, { middleware: [tenantOwner, requireTenantRole("owner", "admin")], handler });
 */
export default function requireTenantRole(...allowed: AllowedRole[]) {
	return middleware(async (context, next) => {
		if (SAFE_METHODS.has(context.request.method.toUpperCase())) return next();
		let role = context.tenant?.role;
		if (!role || !allowed.includes(role)) {
			return forbidden("You do not have permission to perform this action.");
		}
		return next();
	});
}
