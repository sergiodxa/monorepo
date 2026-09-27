/**
 * Checks a resolved management caller against the one scope a route requires,
 * answering a refusal whose `WWW-Authenticate` challenge names that scope, so a
 * client re-authorizes for exactly what the route needs (RFC 6750 §3.1).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ManagementCaller } from "~/app/http/middleware/management-auth";
import type { ManagementResourceServer } from "~/app/lib/management-resource";

import { forbidden } from "~/app/http/middleware/management-auth";

/**
 * Refuses a request whose resolved caller does not carry the given scope.
 *
 * @param ctx - A request `managementAuth` already resolved, carrying its caller and
 * the management API's resource server.
 * @param scope - The scope this route requires, spelled `<resource>:<read|write>`.
 * @returns A `403` `problem+json` response with an `insufficient_scope` challenge
 * naming the missing scope, or `null` once the caller is cleared to proceed.
 * @example
 * let refused = requireScope(ctx, "subjects:write");
 * if (refused) return refused;
 */
export function requireScope(
	ctx: { managementCaller: ManagementCaller; managementApi: ManagementResourceServer },
	scope: string,
): Response | null {
	if (ctx.managementCaller.scopes.includes(scope)) return null;

	return forbidden(ctx.managementApi, `This route requires the "${scope}" scope.`, [scope]);
}
