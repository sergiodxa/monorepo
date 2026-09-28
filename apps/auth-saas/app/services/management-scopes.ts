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
import type Tenant from "~/database/tenant-do";

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

/**
 * What each scope lets a token do — the one place this text is written, read
 * both by the OpenAPI document's OAuth flow description and by the seeding
 * step that adds these scopes to the platform tenant's own catalog.
 */
export const MANAGEMENT_SCOPE_DESCRIPTIONS: Record<ManagementScope, string> = {
	"subjects:read": "Read subjects, their identifiers, roles, grants and credentials",
	"subjects:write": "Create, change, block and delete subjects, and import subjects",
	"sessions:write": "Revoke a subject's sessions",
	"clients:write": "Register, change and delete clients and their secrets",
	"keys:write": "Create, rotate and revoke API keys",
	"webhooks:write": "Register and change webhook endpoints, and replay deliveries",
	"audit:read": "Read the tenant's audit events",
	"export:read": "Export the tenant's subjects",
	"tenant:write": "Change the tenant's domains and sign-in policies",
	"members:write": "Add, invite, change and remove the tenant's members",
};

/** A short label for each scope, for the consent screen a person granting one of these ever sees. */
export const MANAGEMENT_SCOPE_TITLES: Record<ManagementScope, string> = {
	"subjects:read": "Read subjects",
	"subjects:write": "Manage subjects",
	"sessions:write": "Revoke sessions",
	"clients:write": "Manage clients",
	"keys:write": "Manage API keys",
	"webhooks:write": "Manage webhook endpoints",
	"audit:read": "Read audit events",
	"export:read": "Export subjects",
	"tenant:write": "Manage tenant settings",
	"members:write": "Manage tenant members",
};

/**
 * Adds the management API's own scope vocabulary to the platform tenant's scope
 * catalog, leaving a name already present untouched. The platform tenant is the
 * only tenant this vocabulary is ever asked to grant access to, so nothing calls
 * this against any other tenant's own catalog.
 *
 * @param platform - A stub for the platform tenant's own Durable Object.
 * @example
 * await seedManagementScopes(env.TENANT.getByName(env.PLATFORM_DOMAIN));
 */
export async function seedManagementScopes(platform: DurableObjectStub<Tenant>): Promise<void> {
	await platform.defineScopes({
		scopes: MANAGEMENT_SCOPES.map((name) => ({
			name,
			title: MANAGEMENT_SCOPE_TITLES[name],
			description: MANAGEMENT_SCOPE_DESCRIPTIONS[name],
		})),
	});
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
