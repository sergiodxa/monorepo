/**
 * The management API's whole scope vocabulary, and how a tenant membership's role
 * resolves to a scope set. A management client's own registered scopes are checked
 * against {@link MANAGEMENT_SCOPES} at registration; a route names the one scope it
 * requires and checks the caller's resolved set against it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MembershipRole } from "~/app/models/membership";

/** Every scope the management API ever checks, spelled `<resource>:<read|write>`. */
export const MANAGEMENT_SCOPES = [
	"subjects:read",
	"subjects:write",
	"sessions:write",
	"clients:write",
	"keys:write",
	"webhooks:write",
	"audit:read",
	"export:read",
	"tenant:write",
	"members:write",
] as const;

export type ManagementScope = (typeof MANAGEMENT_SCOPES)[number];

/** Whether `value` names one of the scopes the management API recognizes. */
export function isManagementScope(value: string): value is ManagementScope {
	return (MANAGEMENT_SCOPES as readonly string[]).includes(value);
}

/** The two scopes a tenant's own `admin` membership never carries. */
const ADMIN_EXCLUDED_SCOPES = new Set<ManagementScope>(["members:write", "tenant:write"]);

/**
 * Resolves a tenant membership's role to the scopes it carries at the management
 * API: `owner` holds every scope, `admin` holds every scope but the two naming
 * member management and tenant deletion, and `member` holds only the read scopes.
 *
 * @param role - The membership role held at the tenant the scopes are resolved for.
 * @returns The scopes that role carries.
 * @example
 * let scopes = scopesForRole(membership.role);
 */
export function scopesForRole(role: MembershipRole): ManagementScope[] {
	if (role === "owner") return [...MANAGEMENT_SCOPES];
	if (role === "admin") {
		return MANAGEMENT_SCOPES.filter((scope) => !ADMIN_EXCLUDED_SCOPES.has(scope));
	}
	return MANAGEMENT_SCOPES.filter((scope) => scope.endsWith(":read"));
}
