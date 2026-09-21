/**
 * Proves the roles and permissions mechanism this pass builds: the three system roles
 * authorize correctly at a scope with no setup of any kind, a system role cannot be
 * renamed or deleted, a custom role's own vocabulary is defined, granted and enforced
 * through `authorizeSubject`, an organization-scope assignment writes through to
 * `organization_members.role` rather than a `role_assignments` row, and a scope can
 * never be left with no `owner` at all.
 *
 * Drives everything through the `Tenant` object, the way `organizations.test.ts` does,
 * reaching into the underlying storage directly only for what the RPC surface itself
 * does not answer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurableObjectStateMock } from "@sdxc/cloudflare-mocks";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test } from "vitest";

import { organizationMembers } from "./organizations";
import {
	CHANGE_OWNER_ROLE_PERMISSION,
	DELETE_SCOPE_PERMISSION,
	roleAssignments,
	roles,
	TRANSFER_OWNERSHIP_PERMISSION,
} from "./roles";
import Tenant from "./tenant-do";

let state: DurableObjectStateMock;
let tenant: Tenant;

beforeEach(() => {
	state = createDurableObjectState();
	tenant = new Tenant(state, {} as Cloudflare.Env);
});

let nextSuffix = 0;

/** Reads straight off storage for what the RPC surface itself does not answer. */
function testDb(): Database {
	return new Database(createSQLStorageDatabaseAdapter(state.storage.sql));
}

/** A fresh email address, so unrelated tests never collide on identity. */
function nextEmail(): string {
	return `person-${nextSuffix++}@example.com`;
}

/** Creates a subject with one verified email, through the tenant's own RPC surface. */
async function createVerifiedSubject(email: string): Promise<string> {
	let created = await tenant.createSubject({ identifiers: [{ kind: "email", value: email }] });
	if (!created.ok) throw new Error("setup failed");

	let added = await tenant.addIdentifier({
		subjectId: created.subjectId,
		kind: "email",
		value: email,
		actor: { kind: "subject" },
	});
	if (!added.ok || added.kind !== "email") throw new Error("setup failed");

	await tenant.verifyIdentifier({ ticket: added.ticket });

	return created.subjectId;
}

/** Creates an organization, throwing if the call was refused. Its creator already holds `owner`, written by `createOrganization` itself. */
async function createOrg(): Promise<{ organizationId: string; creatorSubjectId: string }> {
	let creatorSubjectId = await createVerifiedSubject(nextEmail());

	let created = await tenant.createOrganization({
		name: "Acme",
		slug: `acme-${nextSuffix++}`,
		creatorSubjectId,
		actor: { type: "subject", id: creatorSubjectId },
	});
	if (!created.ok) throw new Error("setup failed");

	return { organizationId: created.organization.id, creatorSubjectId };
}

/** Adds a subject as a plain `member` of an organization, through the invite/accept RPC surface. */
async function addMember(organizationId: string, invitedBy: string): Promise<string> {
	let email = nextEmail();

	let invited = await tenant.inviteToOrganization({
		organizationId,
		email,
		role: "member",
		invitedBy,
	});
	if (!invited.ok) throw new Error("setup failed");

	let subjectId = await createVerifiedSubject(email);

	let accepted = await tenant.acceptOrganizationInvitation({ token: invited.token, subjectId });
	if (!accepted.ok) throw new Error("setup failed");

	return subjectId;
}

describe("system roles at a brand-new organization", () => {
	test("owner authorizes everything, with no setup beyond the organization existing", async () => {
		let { organizationId, creatorSubjectId } = await createOrg();

		let result = await tenant.authorizeSubject({
			subjectId: creatorSubjectId,
			scope: organizationId,
			permission: "anything.at.all",
		});

		expect(result.authorized).toBe(true);
	});

	test("admin authorizes everything except the three fixed exceptions", async () => {
		let { organizationId, creatorSubjectId } = await createOrg();
		let adminSubjectId = await addMember(organizationId, creatorSubjectId);

		let assigned = await tenant.assignRole({
			subjectId: adminSubjectId,
			scope: organizationId,
			roleKey: "admin",
			actor: { type: "subject", id: creatorSubjectId },
		});
		expect(assigned).toMatchObject({ ok: true, roleKey: "admin" });

		let ordinary = await tenant.authorizeSubject({
			subjectId: adminSubjectId,
			scope: organizationId,
			permission: "anything.at.all",
		});
		expect(ordinary.authorized).toBe(true);

		for (let permission of [
			DELETE_SCOPE_PERMISSION,
			TRANSFER_OWNERSHIP_PERMISSION,
			CHANGE_OWNER_ROLE_PERMISSION,
		]) {
			let excepted = await tenant.authorizeSubject({
				subjectId: adminSubjectId,
				scope: organizationId,
				permission,
			});
			expect(excepted.authorized).toBe(false);
		}
	});

	test("member authorizes nothing beyond existing", async () => {
		let { organizationId, creatorSubjectId } = await createOrg();
		let memberSubjectId = await addMember(organizationId, creatorSubjectId);

		let result = await tenant.authorizeSubject({
			subjectId: memberSubjectId,
			scope: organizationId,
			permission: "anything.at.all",
		});

		expect(result.authorized).toBe(false);
	});
});

describe("defineRole", () => {
	test("refuses a key colliding with a system role", async () => {
		let { organizationId, creatorSubjectId } = await createOrg();

		let result = await tenant.defineRole({
			scope: organizationId,
			key: "owner",
			name: "Owner",
			description: "A custom owner",
			actor: { type: "subject", id: creatorSubjectId },
		});

		expect(result).toMatchObject({ ok: false, reason: "reserved-key" });
	});

	test("refuses a duplicate (scope, key)", async () => {
		let { organizationId, creatorSubjectId } = await createOrg();
		let actor = { type: "subject" as const, id: creatorSubjectId };

		let first = await tenant.defineRole({
			scope: organizationId,
			key: "billing",
			name: "Billing",
			description: "Manages billing",
			actor,
		});
		expect(first.ok).toBe(true);

		let second = await tenant.defineRole({
			scope: organizationId,
			key: "billing",
			name: "Billing Again",
			description: "Also manages billing",
			actor,
		});
		expect(second).toMatchObject({ ok: false, reason: "duplicate" });
	});

	test("the same key is free again at a different scope", async () => {
		let first = await createOrg();
		let second = await createOrg();
		let actor = { type: "subject" as const, id: first.creatorSubjectId };

		let firstDefine = await tenant.defineRole({
			scope: first.organizationId,
			key: "billing",
			name: "Billing",
			description: "Manages billing",
			actor,
		});
		expect(firstDefine.ok).toBe(true);

		let secondDefine = await tenant.defineRole({
			scope: second.organizationId,
			key: "billing",
			name: "Billing",
			description: "Manages billing",
			actor: { type: "subject", id: second.creatorSubjectId },
		});
		expect(secondDefine.ok).toBe(true);
	});
});

describe("updateRole and deleteRole against a system role", () => {
	test("updateRole refuses to rename a system role", async () => {
		let { organizationId, creatorSubjectId } = await createOrg();

		let result = await tenant.updateRole({
			scope: organizationId,
			roleId: "owner",
			name: "Owner Renamed",
			actor: { type: "subject", id: creatorSubjectId },
		});

		expect(result).toMatchObject({ ok: false, reason: "system-role" });
	});

	test("deleteRole refuses to delete a system role", async () => {
		let { organizationId, creatorSubjectId } = await createOrg();

		let result = await tenant.deleteRole({
			scope: organizationId,
			roleId: "owner",
			reassignTo: "admin",
			actor: { type: "subject", id: creatorSubjectId },
		});

		expect(result).toMatchObject({ ok: false, reason: "system-role" });
	});
});

describe("definePermission", () => {
	test("refuses a key beginning auth:", async () => {
		let subjectId = await createVerifiedSubject(nextEmail());

		let result = await tenant.definePermission({
			key: "auth:tenants.manage",
			name: "Manage tenants",
			description: "The platform's own",
			actor: { type: "subject", id: subjectId },
		});

		expect(result).toMatchObject({ ok: false, reason: "reserved-key" });
	});
});

describe("setRolePermissions", () => {
	async function defineCustomRole(organizationId: string, actorId: string) {
		let defined = await tenant.defineRole({
			scope: organizationId,
			key: "billing",
			name: "Billing",
			description: "Manages billing",
			actor: { type: "subject", id: actorId },
		});
		if (!defined.ok) throw new Error("setup failed");
		return defined.role.id;
	}

	test("accepts a set under the byte cap", async () => {
		let { organizationId, creatorSubjectId } = await createOrg();
		let actor = { type: "subject" as const, id: creatorSubjectId };
		let roleId = await defineCustomRole(organizationId, creatorSubjectId);

		let defined = await tenant.definePermission({
			key: "billing.view",
			name: "View billing",
			description: "Read billing records",
			actor,
		});
		if (!defined.ok) throw new Error("setup failed");

		let result = await tenant.setRolePermissions({
			roleId,
			permissionKeys: ["billing.view"],
			actor,
		});

		expect(result).toMatchObject({ ok: true, permissionKeys: ["billing.view"] });
	});

	test("refuses a set over the byte cap, naming the size and the cap", async () => {
		let { organizationId, creatorSubjectId } = await createOrg();
		let actor = { type: "subject" as const, id: creatorSubjectId };
		let roleId = await defineCustomRole(organizationId, creatorSubjectId);

		let permissionKeys: string[] = [];
		for (let index = 0; index < 200; index++) {
			let key = `billing.permission_number_${index}`;
			let defined = await tenant.definePermission({
				key,
				name: key,
				description: key,
				actor,
			});
			if (!defined.ok) throw new Error("setup failed");
			permissionKeys.push(key);
		}

		let result = await tenant.setRolePermissions({ roleId, permissionKeys, actor });

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("unreachable");
		expect(result.reason).toBe("too-large");
		expect(result).toMatchObject({ cap: 1024 });
		if (result.reason === "too-large") expect(result.size).toBeGreaterThan(1024);
	});

	test("refuses a permission key that was never defined", async () => {
		let { organizationId, creatorSubjectId } = await createOrg();
		let actor = { type: "subject" as const, id: creatorSubjectId };
		let roleId = await defineCustomRole(organizationId, creatorSubjectId);

		let result = await tenant.setRolePermissions({
			roleId,
			permissionKeys: ["never.defined"],
			actor,
		});

		expect(result).toMatchObject({ ok: false, reason: "unknown-permission", key: "never.defined" });
	});
});

describe("assignRole at the organization scope", () => {
	test("writes through to organization_members.role, never a role_assignments row", async () => {
		let { organizationId, creatorSubjectId } = await createOrg();
		let memberSubjectId = await addMember(organizationId, creatorSubjectId);

		let assigned = await tenant.assignRole({
			subjectId: memberSubjectId,
			scope: organizationId,
			roleKey: "admin",
			actor: { type: "subject", id: creatorSubjectId },
		});
		expect(assigned).toMatchObject({ ok: true, roleKey: "admin" });

		let membership = await testDb().find(organizationMembers, {
			organization_id: organizationId,
			subject_id: memberSubjectId,
		});
		expect(membership?.role).toBe("admin");

		let assignment = await testDb().find(roleAssignments, {
			subject_id: memberSubjectId,
			scope: "tenant",
		});
		expect(assignment).toBeNull();
	});

	test("refuses an unknown organization", async () => {
		let subjectId = await createVerifiedSubject(nextEmail());

		let result = await tenant.assignRole({
			subjectId,
			scope: "org_does_not_exist",
			roleKey: "admin",
			actor: { type: "subject", id: subjectId },
		});

		expect(result).toMatchObject({ ok: false, reason: "organization-not-found" });
	});

	test("refuses a subject with no membership yet", async () => {
		let { organizationId, creatorSubjectId } = await createOrg();
		let outsider = await createVerifiedSubject(nextEmail());

		let result = await tenant.assignRole({
			subjectId: outsider,
			scope: organizationId,
			roleKey: "admin",
			actor: { type: "subject", id: creatorSubjectId },
		});

		expect(result).toMatchObject({ ok: false, reason: "not-member" });
	});

	test("refuses removing a scope's last owner", async () => {
		let { organizationId, creatorSubjectId } = await createOrg();

		let result = await tenant.assignRole({
			subjectId: creatorSubjectId,
			scope: organizationId,
			roleKey: "member",
			actor: { type: "subject", id: creatorSubjectId },
		});

		expect(result).toMatchObject({ ok: false, reason: "last-owner" });
	});

	test("allows reassigning an owner once a second one holds the role", async () => {
		let { organizationId, creatorSubjectId } = await createOrg();
		let secondSubjectId = await addMember(organizationId, creatorSubjectId);

		let promoted = await tenant.assignRole({
			subjectId: secondSubjectId,
			scope: organizationId,
			roleKey: "owner",
			actor: { type: "subject", id: creatorSubjectId },
		});
		expect(promoted).toMatchObject({ ok: true, roleKey: "owner" });

		let demoted = await tenant.assignRole({
			subjectId: creatorSubjectId,
			scope: organizationId,
			roleKey: "member",
			actor: { type: "subject", id: secondSubjectId },
		});
		expect(demoted).toMatchObject({ ok: true, roleKey: "member" });
	});
});

describe("assignRole at the tenant scope", () => {
	test("writes a role_assignments row keyed by the system role's own key", async () => {
		let subjectId = await createVerifiedSubject(nextEmail());

		let assigned = await tenant.assignRole({
			subjectId,
			scope: "tenant",
			roleKey: "owner",
			actor: { type: "subject", id: subjectId },
		});
		expect(assigned).toMatchObject({ ok: true, roleKey: "owner" });

		let row = await testDb().find(roleAssignments, { subject_id: subjectId, scope: "tenant" });
		expect(row).toMatchObject({ role_id: "owner", scope: "tenant" });
	});

	test("refuses removing the tenant's last owner", async () => {
		let subjectId = await createVerifiedSubject(nextEmail());

		let assigned = await tenant.assignRole({
			subjectId,
			scope: "tenant",
			roleKey: "owner",
			actor: { type: "subject", id: subjectId },
		});
		expect(assigned.ok).toBe(true);

		let demoted = await tenant.assignRole({
			subjectId,
			scope: "tenant",
			roleKey: "member",
			actor: { type: "subject", id: subjectId },
		});
		expect(demoted).toMatchObject({ ok: false, reason: "last-owner" });
	});

	test("a custom role's assignment stores the role's own minted id", async () => {
		let subjectId = await createVerifiedSubject(nextEmail());
		let actor = { type: "subject" as const, id: subjectId };

		let defined = await tenant.defineRole({
			scope: "tenant",
			key: "support",
			name: "Support",
			description: "Reads support tickets",
			actor,
		});
		if (!defined.ok) throw new Error("setup failed");

		let assigned = await tenant.assignRole({
			subjectId,
			scope: "tenant",
			roleKey: "support",
			actor,
		});
		expect(assigned).toMatchObject({ ok: true, roleKey: "support" });

		let row = await testDb().find(roleAssignments, { subject_id: subjectId, scope: "tenant" });
		expect(row?.role_id).toBe(defined.role.id);
	});
});

describe("deleteRole", () => {
	test("reassigns every holder to the given role in the same call", async () => {
		let subjectA = await createVerifiedSubject(nextEmail());
		let subjectB = await createVerifiedSubject(nextEmail());
		let actor = { type: "subject" as const, id: subjectA };

		let defined = await tenant.defineRole({
			scope: "tenant",
			key: "support",
			name: "Support",
			description: "Reads support tickets",
			actor,
		});
		if (!defined.ok) throw new Error("setup failed");

		for (let subjectId of [subjectA, subjectB]) {
			let assigned = await tenant.assignRole({
				subjectId,
				scope: "tenant",
				roleKey: "support",
				actor,
			});
			expect(assigned.ok).toBe(true);
		}

		let deleted = await tenant.deleteRole({
			scope: "tenant",
			roleId: defined.role.id,
			reassignTo: "member",
			actor,
		});
		expect(deleted).toMatchObject({ ok: true, reassigned: 2 });

		for (let subjectId of [subjectA, subjectB]) {
			let row = await testDb().find(roleAssignments, { subject_id: subjectId, scope: "tenant" });
			expect(row?.role_id).toBe("member");
		}

		let remainingRole = await testDb().find(roles, { id: defined.role.id });
		expect(remainingRole).toBeNull();
	});

	test("refuses a reassignment target that does not exist at the same scope", async () => {
		let subjectId = await createVerifiedSubject(nextEmail());
		let actor = { type: "subject" as const, id: subjectId };

		let defined = await tenant.defineRole({
			scope: "tenant",
			key: "support",
			name: "Support",
			description: "Reads support tickets",
			actor,
		});
		if (!defined.ok) throw new Error("setup failed");

		let deleted = await tenant.deleteRole({
			scope: "tenant",
			roleId: defined.role.id,
			reassignTo: "rol_does_not_exist",
			actor,
		});

		expect(deleted).toMatchObject({ ok: false, reason: "invalid-reassignment" });
	});
});

describe("authorizeSubject for a custom role", () => {
	test("reflects whatever setRolePermissions last wrote, including a permission defined after the role was assigned", async () => {
		let subjectId = await createVerifiedSubject(nextEmail());
		let actor = { type: "subject" as const, id: subjectId };

		let defined = await tenant.defineRole({
			scope: "tenant",
			key: "support",
			name: "Support",
			description: "Reads support tickets",
			actor,
		});
		if (!defined.ok) throw new Error("setup failed");

		let assigned = await tenant.assignRole({
			subjectId,
			scope: "tenant",
			roleKey: "support",
			actor,
		});
		expect(assigned.ok).toBe(true);

		let before = await tenant.authorizeSubject({
			subjectId,
			scope: "tenant",
			permission: "tickets.read",
		});
		expect(before.authorized).toBe(false);

		let definedPermission = await tenant.definePermission({
			key: "tickets.read",
			name: "Read tickets",
			description: "Read support tickets",
			actor,
		});
		expect(definedPermission.ok).toBe(true);

		let granted = await tenant.setRolePermissions({
			roleId: defined.role.id,
			permissionKeys: ["tickets.read"],
			actor,
		});
		expect(granted.ok).toBe(true);

		let after = await tenant.authorizeSubject({
			subjectId,
			scope: "tenant",
			permission: "tickets.read",
		});
		expect(after.authorized).toBe(true);

		let describeAccess = await tenant.describeSubjectAccess({ subjectId, scope: "tenant" });
		expect(describeAccess.roles).toHaveLength(1);
		expect(describeAccess.roles[0]).toMatchObject({ key: "support", system: false });
		expect(describeAccess.permissions).toEqual(["tickets.read"]);
	});
});
