/**
 * Checks a resolved management caller against the one scope a route requires,
 * the three-line check every management route otherwise repeats for itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ManagementCaller } from "~/app/http/middleware/management-auth";

import { problem } from "~/app/http/lib/problem";

/**
 * Refuses a request whose resolved caller does not carry the given scope.
 *
 * @param caller - The caller `managementAuth` already resolved for this request.
 * @param scope - The scope this route requires, spelled `<resource>:<read|write>`.
 * @returns A `403` `problem+json` response naming the missing scope, or `null`
 * once the caller is cleared to proceed.
 * @example
 * let refused = requireScope(ctx.managementCaller, "subjects:write");
 * if (refused) return refused;
 */
export function requireScope(caller: ManagementCaller, scope: string): Response | null {
	if (caller.scopes.includes(scope)) return null;

	return problem({
		type: "https://docs.example.com/errors/forbidden",
		title: "This caller may not administer this tenant",
		status: 403,
		detail: `This route requires the "${scope}" scope.`,
	});
}
