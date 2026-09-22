/**
 * Roles and permissions: the `roles`, `permissions`, `role_permissions` and
 * `role_assignments` tables, and the operations that define a tenant's own vocabulary
 * above the three roles the platform reserves at every scope, grant permissions to a
 * role, assign a role to a subject, and answer whether a subject's held role grants a
 * given permission.
 *
 * The three system roles — `owner`, `admin` and `member` — never get a row in `roles`.
 * Their keys, names, descriptions and grants are fixed in this module rather than
 * stored, so a scope answers a system-role check correctly from the instant it exists,
 * with nothing to seed and nothing a caller could forget to provision. A system role's
 * well-known key doubles as its id everywhere a stored role's id would otherwise be
 * expected — `role_assignments.role_id` at the tenant scope, and every input this
 * module calls `roleId` — so the two kinds of role share one namespace without a
 * system role ever needing a row to be addressable.
 *
 * An organization-scope assignment is not written here at all: it lives on
 * `organization_members.role`, already established by the organizations mechanism,
 * because a membership and its role share one lifecycle. `assignRole` writes through to
 * that column for an organization scope and to `role_assignments` for the tenant scope,
 * and every read that resolves a subject's role at a scope follows the same split.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";
import * as s from "remix/data-schema";
import { column as c, table } from "remix/data-table";

import type { AuditActor } from "./audit-events";

import { writeAuditEvent } from "./audit-events";
import { organizationMembers, organizations } from "./organizations";
import { subjects } from "./subjects";

/** The tenant's own directory scope, the one `role_assignments` ever names in `scope`. */
export const TENANT_SCOPE = "tenant";

/** The feature slug defining a role or permission beyond the three system roles is sold under. */
export const CUSTOM_ROLES_FEATURE = "custom_roles";

/** The three role keys the platform reserves at every scope, undeletable and unrenameable. */
export const SYSTEM_ROLE_KEYS = ["owner", "admin", "member"] as const;

export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

/** Whether `value` names one of the three reserved role keys. */
export function isSystemRoleKey(value: string): value is SystemRoleKey {
	return (SYSTEM_ROLE_KEYS as readonly string[]).includes(value);
}

/** Each system role's fixed name and description — never read from storage, since no row holds them. */
const SYSTEM_ROLE_DEFINITIONS: Record<SystemRoleKey, { name: string; description: string }> = {
	owner: {
		name: "Owner",
		description:
			"Every administrative operation on the scope, including deleting it and transferring ownership.",
	},
	admin: {
		name: "Admin",
		description:
			"Every administrative operation except deleting the scope, transferring ownership, and changing an owner's role.",
	},
	member: {
		name: "Member",
		description: "Membership of the scope, and nothing more.",
	},
};

/**
 * The three operations an owner alone may perform. No operation in this pass exists yet
 * to ask for one of these by its own permission key, so these are reserved,
 * permission-key-shaped strings this module alone recognizes — not a tenant's to define
 * and not stored anywhere — purely so `authorizeSubject`'s admin check has something
 * concrete to exclude today and keeps excluding the same three once each operation is
 * built and starts asking with a key of its own.
 */
export const DELETE_SCOPE_PERMISSION = "scope:delete";
export const TRANSFER_OWNERSHIP_PERMISSION = "scope:transfer_ownership";
export const CHANGE_OWNER_ROLE_PERMISSION = "scope:owner.role_change";

const ADMIN_EXCLUDED_PERMISSIONS = new Set<string>([
	DELETE_SCOPE_PERMISSION,
	TRANSFER_OWNERSHIP_PERMISSION,
	CHANGE_OWNER_ROLE_PERMISSION,
]);

/** The key prefix reserved for this platform's own management-API permissions. */
const RESERVED_PERMISSION_PREFIX = "auth:";

/** The largest a role's serialized permission-key set may be, in bytes, enforced by {@link setRolePermissions}. */
const PERMISSION_SET_BYTE_CAP = 1024;

/** Mints a `rol_…` id for a new custom role. */
const roleRowId = typeid("rol");

/** A tenant's own role, defined beyond the three the platform reserves. */
export const roles = table({
	name: "roles",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		scope: c.text(),
		key: c.text(),
		name: c.text(),
		description: c.text(),
		system: c.boolean().default(false),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

/** A tenant's own declared permission vocabulary. */
export const permissions = table({
	name: "permissions",
	primaryKey: ["key"],
	columns: {
		key: c.text(),
		name: c.text(),
		description: c.text(),
		created_at: c.integer(),
	},
});

/** What a role grants: an explicit set of permission keys. */
export const rolePermissions = table({
	name: "role_permissions",
	primaryKey: ["role_id", "permission_key"],
	columns: {
		role_id: c.text(),
		permission_key: c.text(),
	},
});

/** One role held by one subject at the tenant's own directory scope. */
export const roleAssignments = table({
	name: "role_assignments",
	primaryKey: ["subject_id", "scope"],
	columns: {
		subject_id: c.text(),
		role_id: c.text(),
		scope: c.text(),
		assigned_by: c.text(),
		created_at: c.integer(),
	},
});

export type RoleRow = TableRow<typeof roles>;
export type PermissionRow = TableRow<typeof permissions>;
export type RoleAssignmentRow = TableRow<typeof roleAssignments>;

/** A role's public record, whether a stored custom role or one of the three virtual system roles. */
export interface RoleRecord {
	id: string;
	scope: string;
	key: string;
	name: string;
	description: string;
	system: boolean;
	/** `null` for a system role — it holds no row, so it was never created or updated. */
	createdAt: number | null;
	updatedAt: number | null;
}

/** A tenant's own declared permission's public record. */
export interface PermissionRecord {
	key: string;
	name: string;
	description: string;
	createdAt: number;
}

function toRoleRecord(row: RoleRow): RoleRecord {
	return {
		id: row.id,
		scope: row.scope,
		key: row.key,
		name: row.name,
		description: row.description,
		system: row.system,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function toPermissionRecord(row: PermissionRow): PermissionRecord {
	return { key: row.key, name: row.name, description: row.description, createdAt: row.created_at };
}

/** One of the three system roles, as a record built entirely from fixed data — nothing here reads storage. */
function systemRoleRecord(scope: string, key: SystemRoleKey): RoleRecord {
	let definition = SYSTEM_ROLE_DEFINITIONS[key];
	return {
		id: key,
		scope,
		key,
		name: definition.name,
		description: definition.description,
		system: true,
		createdAt: null,
		updatedAt: null,
	};
}

/**
 * Resolves a role by the id a caller already holds — a system role's own key, or a
 * custom role's minted id — scoped to where it must live.
 */
async function resolveRoleById(
	db: Database,
	scope: string,
	roleId: string,
): Promise<RoleRecord | null> {
	if (isSystemRoleKey(roleId)) return systemRoleRecord(scope, roleId);

	let row = await db.find(roles, { id: roleId });
	if (!row || row.scope !== scope) return null;

	return toRoleRecord(row);
}

/** Resolves a role by the key it is held under at a scope — a system role's reserved key, or a custom role's own. */
async function resolveRoleByKey(
	db: Database,
	scope: string,
	key: string,
): Promise<RoleRecord | null> {
	if (isSystemRoleKey(key)) return systemRoleRecord(scope, key);

	let row = await db.findOne(roles, { where: { scope, key } });
	return row ? toRoleRecord(row) : null;
}

/**
 * The permission keys a role grants: every declared permission for `owner` and `admin`
 * alike, since neither system role's fixed meaning restricts a tenant's own vocabulary
 * — the three operations `admin` is denied have no declared permission key of their
 * own for this resolution to leave out — nothing for `member`, and exactly what
 * {@link setRolePermissions} last wrote for a custom role.
 */
async function resolveGrantedPermissions(db: Database, role: RoleRecord): Promise<string[]> {
	if (role.system) {
		if (role.key === "member") return [];
		let declared = await db.findMany(permissions);
		return declared.map((row) => row.key);
	}

	let grants = await db.findMany(rolePermissions, { where: { role_id: role.id } });
	return grants.map((row) => row.permission_key);
}

/** Resolves the one role a subject holds at a scope, following the tenant/organization split every read here shares. */
async function resolveHeldRole(
	db: Database,
	subjectId: string,
	scope: string,
): Promise<RoleRecord | null> {
	if (scope === TENANT_SCOPE) {
		let assignment = await db.find(roleAssignments, { subject_id: subjectId, scope: TENANT_SCOPE });
		if (!assignment) return null;
		return resolveRoleById(db, TENANT_SCOPE, assignment.role_id);
	}

	let membership = await db.find(organizationMembers, {
		organization_id: scope,
		subject_id: subjectId,
	});
	if (!membership) return null;

	return resolveRoleByKey(db, scope, membership.role);
}

export interface DefineRoleInput {
	scope: string;
	key: string;
	name: string;
	description: string;
	actor: AuditActor;
	at?: number;
}

export type DefineRoleResult =
	| { ok: true; role: RoleRecord }
	| { ok: false; reason: "reserved-key" }
	| { ok: false; reason: "duplicate" }
	| { ok: false; reason: "entitlement-required" };

let DefineRoleSchema = s.object({
	scope: s.string(),
	key: s.string(),
	name: s.string(),
	description: s.string(),
});

/**
 * Defines a tenant's own role at a scope, refusing a key that collides with one of the
 * three the platform reserves or with a role this scope already has.
 *
 * @param db - The tenant's database.
 * @param input - The scope and key the role is defined at, its name and description,
 * and who is defining it.
 * @returns The new role's record, or which rule refused the call.
 */
export async function defineRole(db: Database, input: DefineRoleInput): Promise<DefineRoleResult> {
	let parsed = s.parse(DefineRoleSchema, input);
	if (isSystemRoleKey(parsed.key)) return { ok: false, reason: "reserved-key" };

	let existing = await db.findOne(roles, { where: { scope: parsed.scope, key: parsed.key } });
	if (existing) return { ok: false, reason: "duplicate" };

	let now = input.at ?? Date.now();
	let id = roleRowId(generateUUID()).toString();

	await db.create(roles, {
		id,
		scope: parsed.scope,
		key: parsed.key,
		name: parsed.name,
		description: parsed.description,
		system: false,
		created_at: now,
		updated_at: now,
	});

	await writeAuditEvent(db, {
		action: "role.defined",
		actor: input.actor,
		targetType: "role",
		targetId: id,
		outcome: "succeeded",
		detail: { scope: parsed.scope, key: parsed.key },
		at: now,
	});

	let row = await db.find(roles, { id });
	if (!row) throw new Error("role row missing immediately after its own create");

	return { ok: true, role: toRoleRecord(row) };
}

export interface UpdateRoleInput {
	scope: string;
	roleId: string;
	name?: string;
	description?: string;
	actor: AuditActor;
	at?: number;
}

export type UpdateRoleResult =
	| { ok: true; role: RoleRecord }
	| { ok: false; reason: "system-role" }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "entitlement-required" };

/**
 * Updates a custom role's name and description, leaving any field left out exactly as
 * it stood. A system role's name and description are its fixed meaning, so a call
 * naming one is refused outright rather than applied.
 *
 * @param db - The tenant's database.
 * @param input - The role to update, the fields to change, and who is making the call.
 * @returns The role's record once updated, or which rule refused the call.
 */
export async function updateRole(db: Database, input: UpdateRoleInput): Promise<UpdateRoleResult> {
	if (isSystemRoleKey(input.roleId)) return { ok: false, reason: "system-role" };

	let existing = await db.find(roles, { id: input.roleId });
	if (!existing || existing.scope !== input.scope) return { ok: false, reason: "not-found" };
	if (existing.system) return { ok: false, reason: "system-role" };

	let now = input.at ?? Date.now();

	await db.update(
		roles,
		{ id: existing.id },
		{
			...(input.name !== undefined ? { name: input.name } : {}),
			...(input.description !== undefined ? { description: input.description } : {}),
			updated_at: now,
		},
	);

	await writeAuditEvent(db, {
		action: "role.updated",
		actor: input.actor,
		targetType: "role",
		targetId: existing.id,
		outcome: "succeeded",
		at: now,
	});

	let row = await db.find(roles, { id: existing.id });
	if (!row) throw new Error("role row missing immediately after its own update");

	return { ok: true, role: toRoleRecord(row) };
}

export interface DeleteRoleInput {
	scope: string;
	roleId: string;
	/** The role every current holder is moved to — a system role's own key, or a custom role's minted id at the same scope. */
	reassignTo: string;
	actor: AuditActor;
	at?: number;
}

export type DeleteRoleResult =
	| { ok: true; reassigned: number }
	| { ok: false; reason: "system-role" }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "invalid-reassignment" }
	| { ok: false; reason: "entitlement-required" };

/**
 * Deletes a custom role, reassigning every current holder to `reassignTo` in the same
 * call so no subject is left pointing at a role that no longer exists. A system role
 * cannot be deleted.
 *
 * @param db - The tenant's database.
 * @param input - The role to delete, the role its holders move to, and who is making
 * the call.
 * @returns How many holders were reassigned, or which rule refused the call.
 */
export async function deleteRole(db: Database, input: DeleteRoleInput): Promise<DeleteRoleResult> {
	if (isSystemRoleKey(input.roleId)) return { ok: false, reason: "system-role" };

	let role = await db.find(roles, { id: input.roleId });
	if (!role || role.scope !== input.scope) return { ok: false, reason: "not-found" };
	if (role.system) return { ok: false, reason: "system-role" };

	let reassignTo = await resolveRoleById(db, input.scope, input.reassignTo);
	if (!reassignTo) return { ok: false, reason: "invalid-reassignment" };

	let now = input.at ?? Date.now();
	let reassigned = 0;

	if (input.scope === TENANT_SCOPE) {
		let holders = await db.findMany(roleAssignments, {
			where: { scope: TENANT_SCOPE, role_id: role.id },
		});

		for (let holder of holders) {
			await db.update(
				roleAssignments,
				{ subject_id: holder.subject_id, scope: TENANT_SCOPE },
				{
					role_id: reassignTo.system ? reassignTo.key : reassignTo.id,
					assigned_by: input.actor.id,
					created_at: now,
				},
			);
		}

		reassigned = holders.length;
	} else {
		let holders = await db.findMany(organizationMembers, {
			where: { organization_id: input.scope, role: role.key },
		});

		for (let holder of holders) {
			await db.update(
				organizationMembers,
				{ organization_id: input.scope, subject_id: holder.subject_id },
				{ role: reassignTo.key, updated_at: now },
			);
		}

		reassigned = holders.length;
	}

	await db.deleteMany(rolePermissions, { where: { role_id: role.id } });
	await db.delete(roles, { id: role.id });

	await writeAuditEvent(db, {
		action: "role.deleted",
		actor: input.actor,
		targetType: "role",
		targetId: role.id,
		outcome: "succeeded",
		detail: { scope: input.scope, key: role.key, reassignedTo: reassignTo.key, reassigned },
		at: now,
	});

	return { ok: true, reassigned };
}

export interface DefinePermissionInput {
	key: string;
	name: string;
	description: string;
	actor: AuditActor;
	at?: number;
}

export type DefinePermissionResult =
	| { ok: true; permission: PermissionRecord }
	| { ok: false; reason: "reserved-key" }
	| { ok: false; reason: "duplicate" }
	| { ok: false; reason: "entitlement-required" };

let DefinePermissionSchema = s.object({
	key: s.string(),
	name: s.string(),
	description: s.string(),
});

/**
 * Defines a tenant's own permission, refusing a key beginning `auth:` — reserved for
 * this platform's own management-API permissions, not a tenant's to claim.
 *
 * @param db - The tenant's database.
 * @param input - The permission's key, name and description, and who is defining it.
 * @returns The new permission's record, or which rule refused the call.
 */
export async function definePermission(
	db: Database,
	input: DefinePermissionInput,
): Promise<DefinePermissionResult> {
	let parsed = s.parse(DefinePermissionSchema, input);
	if (parsed.key.startsWith(RESERVED_PERMISSION_PREFIX))
		return { ok: false, reason: "reserved-key" };

	let existing = await db.find(permissions, { key: parsed.key });
	if (existing) return { ok: false, reason: "duplicate" };

	let now = input.at ?? Date.now();

	await db.create(permissions, {
		key: parsed.key,
		name: parsed.name,
		description: parsed.description,
		created_at: now,
	});

	await writeAuditEvent(db, {
		action: "permission.defined",
		actor: input.actor,
		targetType: "permission",
		targetId: parsed.key,
		outcome: "succeeded",
		at: now,
	});

	let row = await db.find(permissions, { key: parsed.key });
	if (!row) throw new Error("permission row missing immediately after its own create");

	return { ok: true, permission: toPermissionRecord(row) };
}

export interface RemovePermissionInput {
	key: string;
	actor: AuditActor;
	at?: number;
}

export type RemovePermissionResult =
	| { ok: true }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "entitlement-required" };

/**
 * Removes a tenant's own permission, dropping every role's grant of it in the same
 * call so no `role_permissions` row is left naming a permission that no longer exists.
 *
 * @param db - The tenant's database.
 * @param input - The permission to remove, and who is making the call.
 * @returns Success, or that no such permission exists.
 */
export async function removePermission(
	db: Database,
	input: RemovePermissionInput,
): Promise<RemovePermissionResult> {
	let existing = await db.find(permissions, { key: input.key });
	if (!existing) return { ok: false, reason: "not-found" };

	let now = input.at ?? Date.now();

	await db.deleteMany(rolePermissions, { where: { permission_key: input.key } });
	await db.delete(permissions, { key: input.key });

	await writeAuditEvent(db, {
		action: "permission.removed",
		actor: input.actor,
		targetType: "permission",
		targetId: input.key,
		outcome: "succeeded",
		at: now,
	});

	return { ok: true };
}

export interface SetRolePermissionsInput {
	roleId: string;
	permissionKeys: string[];
	actor: AuditActor;
	at?: number;
}

export type SetRolePermissionsResult =
	| { ok: true; permissionKeys: string[] }
	| { ok: false; reason: "system-role" }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "unknown-permission"; key: string }
	| { ok: false; reason: "too-large"; size: number; cap: number }
	| { ok: false; reason: "entitlement-required" };

let SetRolePermissionsSchema = s.object({
	roleId: s.string(),
	permissionKeys: s.array(s.string()),
});

/**
 * Replaces a custom role's whole granted set: deletes every `role_permissions` row it
 * holds and writes the given keys in the same call, refusing a set whose serialized
 * form would exceed what a token's `permissions` claim may carry, and a key naming no
 * declared permission.
 *
 * @param db - The tenant's database.
 * @param input - The role to set, its whole new set of permission keys, and who is
 * making the call.
 * @returns The set now granted, or which rule refused the call.
 */
export async function setRolePermissions(
	db: Database,
	input: SetRolePermissionsInput,
): Promise<SetRolePermissionsResult> {
	let parsed = s.parse(SetRolePermissionsSchema, input);

	if (isSystemRoleKey(parsed.roleId)) return { ok: false, reason: "system-role" };

	let role = await db.find(roles, { id: parsed.roleId });
	if (!role) return { ok: false, reason: "not-found" };
	if (role.system) return { ok: false, reason: "system-role" };

	let uniqueKeys = [...new Set(parsed.permissionKeys)];

	let size = new TextEncoder().encode(JSON.stringify(uniqueKeys)).length;
	if (size > PERMISSION_SET_BYTE_CAP) {
		return { ok: false, reason: "too-large", size, cap: PERMISSION_SET_BYTE_CAP };
	}

	for (let key of uniqueKeys) {
		let permission = await db.find(permissions, { key });
		if (!permission) return { ok: false, reason: "unknown-permission", key };
	}

	let now = input.at ?? Date.now();

	await db.deleteMany(rolePermissions, { where: { role_id: role.id } });
	for (let key of uniqueKeys) {
		await db.create(rolePermissions, { role_id: role.id, permission_key: key });
	}

	await writeAuditEvent(db, {
		action: "role.permissions_set",
		actor: input.actor,
		targetType: "role",
		targetId: role.id,
		outcome: "succeeded",
		detail: { permissionKeys: uniqueKeys },
		at: now,
	});

	return { ok: true, permissionKeys: uniqueKeys };
}

export interface AssignRoleInput {
	subjectId: string;
	scope: string;
	roleKey: string;
	actor: AuditActor;
	at?: number;
}

export type AssignRoleResult =
	| { ok: true; roleKey: string }
	| { ok: false; reason: "role-not-found" }
	| { ok: false; reason: "subject-not-found" }
	| { ok: false; reason: "organization-not-found" }
	| { ok: false; reason: "not-member" }
	| { ok: false; reason: "last-owner" };

let AssignRoleSchema = s.object({
	subjectId: s.string(),
	scope: s.string(),
	roleKey: s.string(),
});

/**
 * Assigns a role to a subject at a scope, replacing any role already held there — one
 * role per subject per scope. A tenant-scope assignment writes `role_assignments`; an
 * organization-scope assignment writes through to `organization_members.role` instead,
 * refusing an organization that does not exist or a subject with no membership in it —
 * assigning a role presupposes membership, it does not create one. Either scope refuses
 * a reassignment that would leave the scope with no `owner` at all.
 *
 * @param db - The tenant's database.
 * @param input - The subject, the scope the role is held at, the role's key, and who is
 * making the call.
 * @returns The role now held, or which rule refused the call.
 */
export async function assignRole(db: Database, input: AssignRoleInput): Promise<AssignRoleResult> {
	let parsed = s.parse(AssignRoleSchema, input);
	let now = input.at ?? Date.now();

	let role = await resolveRoleByKey(db, parsed.scope, parsed.roleKey);
	if (!role) return { ok: false, reason: "role-not-found" };

	if (parsed.scope === TENANT_SCOPE) {
		let subject = await db.find(subjects, { id: parsed.subjectId });
		if (!subject) return { ok: false, reason: "subject-not-found" };

		let existing = await db.find(roleAssignments, {
			subject_id: parsed.subjectId,
			scope: TENANT_SCOPE,
		});

		if (existing && role.key !== "owner") {
			let existingRole = await resolveRoleById(db, TENANT_SCOPE, existing.role_id);
			if (existingRole?.key === "owner") {
				let ownerCount = await db.count(roleAssignments, {
					where: { scope: TENANT_SCOPE, role_id: "owner" },
				});
				if (ownerCount <= 1) return { ok: false, reason: "last-owner" };
			}
		}

		let roleIdValue = role.system ? role.key : role.id;

		if (existing) {
			await db.update(
				roleAssignments,
				{ subject_id: parsed.subjectId, scope: TENANT_SCOPE },
				{ role_id: roleIdValue, assigned_by: input.actor.id, created_at: now },
			);
		} else {
			await db.create(roleAssignments, {
				subject_id: parsed.subjectId,
				role_id: roleIdValue,
				scope: TENANT_SCOPE,
				assigned_by: input.actor.id,
				created_at: now,
			});
		}
	} else {
		let organization = await db.find(organizations, { id: parsed.scope });
		if (!organization) return { ok: false, reason: "organization-not-found" };

		let membership = await db.find(organizationMembers, {
			organization_id: parsed.scope,
			subject_id: parsed.subjectId,
		});
		if (!membership) return { ok: false, reason: "not-member" };

		if (membership.role === "owner" && role.key !== "owner") {
			let ownerCount = await db.count(organizationMembers, {
				where: { organization_id: parsed.scope, role: "owner" },
			});
			if (ownerCount <= 1) return { ok: false, reason: "last-owner" };
		}

		await db.update(
			organizationMembers,
			{ organization_id: parsed.scope, subject_id: parsed.subjectId },
			{ role: role.key, updated_at: now },
		);
	}

	await writeAuditEvent(db, {
		action: "role.assigned",
		actor: input.actor,
		targetType: "subject",
		targetId: parsed.subjectId,
		outcome: "succeeded",
		detail: { scope: parsed.scope, roleKey: role.key },
		at: now,
	});

	return { ok: true, roleKey: role.key };
}

export interface DescribeSubjectAccessInput {
	subjectId: string;
	scope: string;
}

/** The role(s) a subject holds at a scope, and the resolved union of what they grant. */
export interface SubjectAccessSummary {
	roles: RoleRecord[];
	permissions: string[];
}

/**
 * The role a subject holds at a scope and its resolved permission set — written as a
 * union over every held role so the shape holds even though this pass's one-role-per-
 * scope rule makes it exactly one role today.
 *
 * @param db - The tenant's database.
 * @param input - The subject and scope to describe.
 * @returns The held role (empty when none) and the permission keys it resolves to.
 */
export async function describeSubjectAccess(
	db: Database,
	input: DescribeSubjectAccessInput,
): Promise<SubjectAccessSummary> {
	let role = await resolveHeldRole(db, input.subjectId, input.scope);
	if (!role) return { roles: [], permissions: [] };

	return { roles: [role], permissions: await resolveGrantedPermissions(db, role) };
}

export interface ListRolesInput {
	scope: string;
}

export interface ListRolesResult {
	roles: RoleRecord[];
}

let ListRolesSchema = s.object({ scope: s.string() });

/**
 * Every role held at a scope: the three system roles first, always present since
 * neither needs a row to exist, followed by whatever custom roles this scope has
 * defined. Unpaginated — a scope's own role catalog is the three reserved keys
 * plus whatever a tenant has defined for itself, small enough that a caller
 * managing roles is better served seeing the whole list at once than paging
 * through a handful of rows.
 *
 * @param db - The tenant's database.
 * @param input - The scope to list roles at.
 * @returns Every role held at that scope, system roles first.
 */
export async function listRoles(db: Database, input: ListRolesInput): Promise<ListRolesResult> {
	let parsed = s.parse(ListRolesSchema, input);

	let systemRoles = SYSTEM_ROLE_KEYS.map((key) => systemRoleRecord(parsed.scope, key));
	let customRows = await db.findMany(roles, { where: { scope: parsed.scope } });

	return { roles: [...systemRoles, ...customRows.map(toRoleRecord)] };
}

export interface ListPermissionsResult {
	permissions: PermissionRecord[];
}

/**
 * Every permission this tenant has declared. Tenant-wide rather than scoped to
 * one role or one scope, since `permissions` carries no scope column of its
 * own — a permission is granted to a role at whatever scope that role lives at,
 * not declared at one itself. Unpaginated — a tenant's own declared vocabulary
 * stays small enough for a caller managing roles to read in one call.
 *
 * @param db - The tenant's database.
 * @returns Every permission this tenant has declared.
 */
export async function listPermissions(db: Database): Promise<ListPermissionsResult> {
	let rows = await db.findMany(permissions);
	return { permissions: rows.map(toPermissionRecord) };
}

export interface ResolveRoleAndPermissionClaimsInput {
	subjectId: string;
	/** The scope a token's or a `/userinfo` response's second role, beyond the tenant scope, resolves at. */
	activeOrganizationId: string | null;
}

export interface ResolveRoleAndPermissionClaimsResult {
	roleKeys: string[];
	permissionKeys: string[];
}

/**
 * The role keys and the union of granted permission keys a subject holds across the
 * scopes a token's or a `/userinfo` response's `roles`/`permissions` claims name: the
 * tenant scope every session resolves, plus the active organization's scope when one is
 * given. The one place this resolution is written, so a token minted at sign-in and a
 * later `/userinfo` read of the same session answer from the same facts.
 *
 * @param db - The tenant's database.
 * @param input - The subject, and the active organization scope to resolve alongside
 * the tenant scope, or `null` for none.
 * @returns The role keys held, and the resolved permission keys they grant.
 */
export async function resolveRoleAndPermissionClaims(
	db: Database,
	input: ResolveRoleAndPermissionClaimsInput,
): Promise<ResolveRoleAndPermissionClaimsResult> {
	let tenantAccess = await describeSubjectAccess(db, {
		subjectId: input.subjectId,
		scope: TENANT_SCOPE,
	});
	let roleKeys = tenantAccess.roles.map((role) => role.key);
	let permissionKeys = new Set(tenantAccess.permissions);

	if (input.activeOrganizationId !== null) {
		let orgAccess = await describeSubjectAccess(db, {
			subjectId: input.subjectId,
			scope: input.activeOrganizationId,
		});
		for (let role of orgAccess.roles) roleKeys.push(role.key);
		for (let permission of orgAccess.permissions) permissionKeys.add(permission);
	}

	return { roleKeys, permissionKeys: [...permissionKeys] };
}

export interface AuthorizeSubjectInput {
	subjectId: string;
	scope: string;
	permission: string;
	at?: number;
}

export interface AuthorizeSubjectResult {
	authorized: boolean;
}

/**
 * The single-decision check every other authorization question in this mechanism
 * reduces to: does the role this subject holds at this scope grant this permission.
 * `owner` authorizes everything; `admin` authorizes everything except the three
 * operations {@link DELETE_SCOPE_PERMISSION}, {@link TRANSFER_OWNERSHIP_PERMISSION} and
 * {@link CHANGE_OWNER_ROLE_PERMISSION} name, regardless of whether the permission asked
 * for was even declared yet; `member` authorizes nothing. A custom role answers from
 * whatever {@link setRolePermissions} last wrote for it, including a permission
 * declared after the role was assigned — this reads the grant fresh every time rather
 * than from anything cached at assignment.
 *
 * @param db - The tenant's database.
 * @param input - The subject, the scope, and the permission being asked for.
 * @returns Whether the subject's held role grants it.
 */
export async function authorizeSubject(
	db: Database,
	input: AuthorizeSubjectInput,
): Promise<AuthorizeSubjectResult> {
	let role = await resolveHeldRole(db, input.subjectId, input.scope);
	if (!role) return { authorized: false };

	if (role.system) {
		if (role.key === "owner") return { authorized: true };
		if (role.key === "member") return { authorized: false };
		return { authorized: !ADMIN_EXCLUDED_PERMISSIONS.has(input.permission) };
	}

	let grant = await db.find(rolePermissions, {
		role_id: role.id,
		permission_key: input.permission,
	});
	return { authorized: grant !== null };
}
