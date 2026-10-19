/**
 * Who may do what through the management API. Each OAuth scope is a `scope:<name>` role
 * granting the abilities that name it, and a membership role inherits the scope roles it
 * carries, so a token bound `within` its scope roles never exceeds its consent nor its role.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AbilityName, RoleOf } from "@sdxc/authz";

import { allow, definePolicy, deny, fact } from "@sdxc/authz";

import type { MembershipRole } from "~/app/models/memberships";
import type { ManagementScope } from "~/app/services/management-scopes";

import abilities from "~/app/policies/abilities";
import { MANAGEMENT_SCOPES } from "~/app/services/management-scopes";

/**
 * The scope an export of password hashes needs beside `export:read`. It sits outside
 * `MANAGEMENT_SCOPES`, so no role carries it and no client registers it.
 */
export const CREDENTIALS_EXPORT_SCOPE = "export:credentials";

/** Every scope some ability names. */
export type PolicyScope = ManagementScope | typeof CREDENTIALS_EXPORT_SCOPE;

/** The role a token holding one scope is bound to. */
export type ScopeRole = `scope:${PolicyScope}`;

/** Every role the policy defines. */
type PolicyRole = MembershipRole | ScopeRole;

/** A name a grant may cover. */
type Name = AbilityName<typeof abilities>;

/** The scopes some ability names, each with its own role. */
const POLICY_SCOPES: readonly PolicyScope[] = [...MANAGEMENT_SCOPES, CREDENTIALS_EXPORT_SCOPE];

/**
 * The role standing for one scope.
 *
 * @example scopeRole("subjects:read") // "scope:subjects:read"
 */
export function scopeRole(scope: PolicyScope): ScopeRole {
	return `scope:${scope}`;
}

/** The scope roles for a token's granted scopes, dropping any name the policy never checks. */
export function scopeRoles(scopes: readonly string[]): ScopeRole[] {
	return POLICY_SCOPES.filter((scope) => scopes.includes(scope)).map(scopeRole);
}

/** One scope's role: every ability whose metadata names that scope. */
function scopeGrants(scope: PolicyScope): RoleOf<Name, PolicyRole> {
	let names = abilities.filter({ metadata: { scope } }).map((each) => each.name as Name);
	return [allow(names, { id: scopeRole(scope) })];
}

/** Every scope role, built from the catalog's metadata. */
const SCOPE_ROLES = Object.fromEntries(
	POLICY_SCOPES.map((scope) => [scopeRole(scope), scopeGrants(scope)]),
) as Record<ScopeRole, RoleOf<Name, PolicyRole>>;

/** Refuses an ability sold as `feature` to a tenant whose billing does not grant it. */
function entitlementGuard(ability: Name, feature: string) {
	return deny(ability, {
		id: `entitlement:${feature}`,
		when: { op: "not", of: { op: "includes", field: "billing.features", value: feature } },
		reason: `entitlement:${feature}`,
	});
}

/**
 * `member` reads, `admin` also writes everything but members and tenant settings, and
 * `owner` holds every scope and manages billing. `billing` lists the paid features the
 * caller's tenant holds right now.
 */
const policy = definePolicy(abilities, {
	facts: { billing: fact<{ features: string[] }>() },
	roles: {
		...SCOPE_ROLES,
		member: {
			inherits: [scopeRole("subjects:read"), scopeRole("audit:read"), scopeRole("export:read")],
			grants: [],
		},
		admin: {
			inherits: [
				"member",
				scopeRole("subjects:write"),
				scopeRole("sessions:write"),
				scopeRole("clients:write"),
				scopeRole("keys:write"),
				scopeRole("webhooks:write"),
			],
			grants: [],
		},
		owner: {
			inherits: ["admin", scopeRole("members:write"), scopeRole("tenant:write")],
			grants: [allow("billing.manage", { id: "owner:billing" })],
		},
	} satisfies Record<PolicyRole, RoleOf<Name, PolicyRole>>,
	guards: [
		entitlementGuard("tenant.domains.attach", "custom_domain"),
		entitlementGuard("tenant.sessionPolicy.set", "session_policy"),
	],
});

declare module "@sdxc/authz" {
	/** Types `ctx.access` and every check against the management catalog. */
	interface AuthzTypes {
		policy: typeof policy;
	}
}

export default policy;

/**
 * The scopes a membership role carries, read off the scope roles it inherits, in the
 * vocabulary's order; a person's token reaches at most these whatever its consent says.
 *
 * @example scopesForRole("admin") // every scope but members:write and tenant:write
 */
export function scopesForRole(role: MembershipRole): ManagementScope[] {
	let reached = new Set<string>();
	let pending: string[] = [role];
	while (pending.length > 0) {
		let next = pending.pop() as string;
		if (reached.has(next)) continue;
		reached.add(next);
		let definition = policy.definition.roles?.[next as PolicyRole];
		if (definition !== undefined && "inherits" in definition) {
			pending.push(...(definition.inherits ?? []));
		}
	}
	return MANAGEMENT_SCOPES.filter((scope) => reached.has(scopeRole(scope)));
}

/**
 * The scope a refusal of the named ability asks a client to re-authorize for, or `null`
 * for an ability no scope reaches.
 */
export function scopeOfAbility(name: string): string | null {
	let found = abilities.list().find((each) => each.name === name);
	let scope = found?.metadata.scope;
	return typeof scope === "string" ? scope : null;
}
