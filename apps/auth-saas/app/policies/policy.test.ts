/**
 * Holds the policy to the scope matrix the management API enforced by hand: the scope each
 * operation required, the scopes each membership role carried, the intersection a person's
 * token was cut to, and the paid features two writes were sold as.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyAbility } from "@sdxc/authz";

import { testAccess } from "@sdxc/authz/testing";
import { describe, expect, test } from "vite-plus/test";

import type { MembershipRole } from "~/app/models/memberships";

import abilities from "~/app/policies/abilities";
import policy, {
	CREDENTIALS_EXPORT_SCOPE,
	scopeOfAbility,
	scopeRoles,
	scopesForRole,
} from "~/app/policies/policy";
import { MANAGEMENT_SCOPES } from "~/app/services/management-scopes";

/** The scope every management operation required, one `requireScope` call each. */
const OPERATION_SCOPES: Record<string, string> = {
	agentClientsRegister: "clients:write",
	apiKeysCreate: "keys:write",
	apiKeysList: "keys:write",
	apiKeysRead: "keys:write",
	apiKeysRevoke: "keys:write",
	apiKeysRotate: "keys:write",
	auditEventsList: "audit:read",
	clientsDelete: "clients:write",
	clientsDisable: "clients:write",
	clientsList: "clients:write",
	clientsRead: "clients:write",
	clientsRegister: "clients:write",
	clientsRevokeSecret: "clients:write",
	clientsRotateSecret: "clients:write",
	clientsUpdate: "clients:write",
	passkeysList: "subjects:write",
	passkeysRename: "subjects:write",
	passkeysRevoke: "subjects:write",
	passwordForceReset: "subjects:write",
	secondFactorReset: "subjects:write",
	secondFactorTrustedDevicesRevoke: "subjects:write",
	sessionsList: "sessions:write",
	sessionsRevoke: "sessions:write",
	sessionsRevokeAll: "sessions:write",
	subjectAccessRead: "members:write",
	subjectRolesAssign: "members:write",
	rolesDefine: "members:write",
	rolesDelete: "members:write",
	subjectGrantsList: "subjects:read",
	subjectGrantsRevoke: "subjects:write",
	rolesList: "members:write",
	permissionsList: "members:write",
	permissionsDefine: "members:write",
	permissionsRemove: "members:write",
	rolesSetPermissions: "members:write",
	rolesUpdate: "members:write",
	subjectsBlock: "subjects:write",
	subjectsCreate: "subjects:write",
	subjectsDelete: "subjects:write",
	subjectsExportStatus: "export:read",
	subjectsExportBegin: "export:read",
	subjectIdentifiersAdd: "subjects:write",
	subjectIdentifiersVerify: "subjects:write",
	subjectIdentifiersSetPrimary: "subjects:write",
	subjectIdentifiersRemove: "subjects:write",
	subjectsImportStatus: "subjects:read",
	subjectsImportBegin: "subjects:write",
	subjectsList: "subjects:read",
	subjectsRead: "subjects:read",
	subjectsUnblock: "subjects:write",
	subjectsUpdate: "subjects:write",
	tenantDomainsList: "tenant:write",
	tenantDomainsAttach: "tenant:write",
	tenantDomainsVerification: "tenant:write",
	tenantDomainsRemove: "tenant:write",
	tenantMembersInvite: "members:write",
	tenantMembersList: "members:write",
	tenantMembersCreate: "members:write",
	tenantMembersUpdateRole: "members:write",
	tenantMembersRemove: "members:write",
	tenantMfaPolicySet: "tenant:write",
	tenantRead: "tenant:write",
	tenantSessionPolicyDescribe: "tenant:write",
	tenantSessionPolicySet: "tenant:write",
	webhookEndpointsDelete: "webhooks:write",
	webhookDeliveriesList: "webhooks:write",
	webhookDeliveriesReplay: "webhooks:write",
	webhookEndpointsList: "webhooks:write",
	webhookEndpointsRead: "webhooks:write",
	webhookEndpointsRegister: "webhooks:write",
	webhookEndpointsRotateSecret: "webhooks:write",
	webhookEndpointsUpdate: "webhooks:write",
};

/** The scopes each membership role resolved to before the policy existed. */
const ROLE_SCOPES: Record<MembershipRole, string[]> = {
	owner: [...MANAGEMENT_SCOPES],
	admin: MANAGEMENT_SCOPES.filter((scope) => scope !== "members:write" && scope !== "tenant:write"),
	member: ["subjects:read", "audit:read", "export:read"],
};

const ROLES: MembershipRole[] = ["member", "admin", "owner"];

/** Every scope some check names, the credentials export's included. */
const ALL_SCOPES = [...MANAGEMENT_SCOPES, CREDENTIALS_EXPORT_SCOPE];

/** Every paid feature granted, so a guard never stands between a role and its grant. */
const ENTITLED = { billing: { features: ["custom_domain", "session_policy"] } };

/** Every ability a scope reaches, the dashboard-only billing ability left out. */
function scopedAbilities(): AnyAbility[] {
	return abilities.list().filter((each) => typeof each.metadata.scope === "string");
}

describe("the catalog", () => {
	test("names one ability for every operation, under the scope that operation required", () => {
		let operations = Object.fromEntries(
			scopedAbilities()
				.filter((each) => typeof each.metadata.operation === "string")
				.map((each) => [each.metadata.operation as string, each.metadata.scope]),
		);
		expect(operations).toEqual(OPERATION_SCOPES);
	});

	test("reads each ability's scope back for the refusal's challenge", () => {
		expect(scopeOfAbility(abilities.subjects.read.name)).toBe("subjects:read");
		expect(scopeOfAbility(abilities.subjects.export.credentials.name)).toBe("export:credentials");
		expect(scopeOfAbility(abilities.billing.manage.name)).toBeNull();
	});
});

describe("membership roles", () => {
	test("carry the scopes each role resolved to", () => {
		for (let role of ROLES) expect(scopesForRole(role).sort()).toEqual(ROLE_SCOPES[role].sort());
	});

	test.each(ROLES)("%s reaches exactly the abilities its scopes name", (role) => {
		let access = testAccess(policy, { roles: [role], facts: ENTITLED });
		for (let each of scopedAbilities()) {
			expect([each.name, access.can(each)]).toEqual([
				each.name,
				ROLE_SCOPES[role].includes(each.metadata.scope as string),
			]);
		}
	});

	test("only an owner manages billing", () => {
		for (let role of ROLES) {
			let access = testAccess(policy, { roles: [role], facts: ENTITLED });
			expect([role, access.can(abilities.billing.manage)]).toEqual([role, role === "owner"]);
		}
	});
});

describe("a token's scopes", () => {
	test.each(ALL_SCOPES)("an agent client holding %s reaches that scope's abilities", (scope) => {
		let access = testAccess(policy, { roles: scopeRoles([scope]), facts: ENTITLED });
		for (let each of scopedAbilities()) {
			expect([each.name, access.can(each)]).toEqual([each.name, each.metadata.scope === scope]);
		}
	});

	test("an agent client reaches no ability through a scope the policy never checks", () => {
		expect(scopeRoles(["subjects:delete", "subjects:read"])).toEqual(["scope:subjects:read"]);
	});

	test.each(ROLES)("a %s's own token reaches its role's scopes cut to its consent", (role) => {
		for (let scope of ALL_SCOPES) {
			let access = testAccess(policy, {
				roles: [role],
				within: scopeRoles([scope]),
				facts: ENTITLED,
			});
			for (let each of scopedAbilities()) {
				let expected = each.metadata.scope === scope && ROLE_SCOPES[role].includes(scope);
				expect([scope, each.name, access.can(each)]).toEqual([scope, each.name, expected]);
			}
		}
	});

	test("a consent narrower than the role refuses as out of scope", () => {
		let access = testAccess(policy, {
			roles: ["owner"],
			within: scopeRoles(["subjects:read"]),
			facts: ENTITLED,
		});
		expect(access.check(abilities.subjects.create)).toMatchObject({ cause: "outOfScope" });
	});
});

describe("paid features", () => {
	test.each([
		[abilities.tenant.domains.attach, "custom_domain"],
		[abilities.tenant.sessionPolicy.set, "session_policy"],
	] as const)("%s needs the tenant to hold %s", (ability, feature) => {
		let unpaid = testAccess(policy, { roles: ["owner"], facts: { billing: { features: [] } } });
		expect(unpaid.check(ability)).toMatchObject({
			cause: "denied",
			reason: `entitlement:${feature}`,
		});

		let paid = testAccess(policy, {
			roles: ["owner"],
			facts: { billing: { features: [feature] } },
		});
		expect(paid.can(ability)).toBe(true);
	});

	test("an unpaid feature refuses before the missing scope does", () => {
		let access = testAccess(policy, {
			roles: scopeRoles(["subjects:read"]),
			facts: { billing: { features: [] } },
		});
		expect(access.check(abilities.tenant.domains.attach)).toMatchObject({
			cause: "denied",
			reason: "entitlement:custom_domain",
		});
	});
});
