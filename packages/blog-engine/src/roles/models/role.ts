/**
 * Role persistence: the {@link Role} repository for runtime-defined roles that bundle
 * permission keys, with built-in protection (built-ins keep their name and
 * permissions) and the admin/reader lookups used during login and authorization.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Database } from "remix/data-table";

import type { SelectRole } from "../../database/schema.js";
import type { Permission } from "../../shared/permissions.js";

import { roles } from "../../database/schema.js";
import {
	ADMIN_PERMISSIONS,
	hasAll,
	parsePermissions,
	PERMISSION_KEYS,
} from "../../shared/permissions.js";

/** A role with its permission set decoded from JSON. */
export interface RoleWithPermissions {
	id: string;
	name: string;
	label: string;
	description: string;
	permissions: Permission[];
	builtin: boolean;
}

/** Fields accepted by {@link Role.create} and {@link Role.update}; `permissions` must be catalog keys. */
export interface RoleInput {
	name: string;
	label: string;
	description?: string;
	permissions: Permission[];
}

/** Repository for runtime-defined roles with built-in protection. */
export class Role {
	/** Table reference shared by all queries. */
	static table = roles;

	/** Thrown when a role mutation violates an invariant. */
	static InvalidError = class extends Error {
		constructor(message: string) {
			super(message);
			this.name = "RoleInvalidError";
		}
	};

	/**
	 * Lists all roles.
	 * @param db - Database handle.
	 * @returns Every role with its permissions decoded.
	 */
	static async findAll(db: Database): Promise<RoleWithPermissions[]> {
		let rows = await db.findMany(this.table);
		return rows.map((row) => this.toRole(row));
	}

	/**
	 * Finds a role by id.
	 * @param db - Database handle.
	 * @param id - The role id.
	 * @returns The role with permissions, or `null` when not found.
	 */
	static async findById(db: Database, id: string): Promise<RoleWithPermissions | null> {
		let row = await db.findOne(this.table, { where: { id } });
		return row ? this.toRole(row) : null;
	}

	/**
	 * Finds a role by its machine name.
	 * @param db - Database handle.
	 * @param name - The role machine name (e.g. "admin").
	 * @returns The role with permissions, or `null` when not found.
	 */
	static async findByName(db: Database, name: string): Promise<RoleWithPermissions | null> {
		let row = await db.findOne(this.table, { where: { name } });
		return row ? this.toRole(row) : null;
	}

	/**
	 * Resolves the seeded admin role id (used for first-admin bootstrap and the
	 * allowlist).
	 * @param db - Database handle.
	 * @returns The admin role id.
	 * @throws {Role.InvalidError} When the admin role is missing (unseeded database).
	 */
	static async adminRoleId(db: Database): Promise<string> {
		let admin = await this.findByName(db, "admin");
		if (!admin) throw new this.InvalidError("Admin role missing (unseeded database).");
		return admin.id;
	}

	/**
	 * Resolves the seeded reader role id (default for every user after the first admin).
	 * @param db - Database handle.
	 * @returns The reader role id.
	 * @throws {Role.InvalidError} When the reader role is missing (unseeded database).
	 */
	static async readerRoleId(db: Database): Promise<string> {
		let reader = await this.findByName(db, "reader");
		if (!reader) throw new this.InvalidError("Reader role missing (unseeded database).");
		return reader.id;
	}

	/**
	 * Returns the permission set granted by a role.
	 * @param db - Database handle.
	 * @param roleId - The role id to resolve.
	 * @returns The granted permissions, or an empty set when the role is missing.
	 */
	static async permissionsFor(db: Database, roleId: string): Promise<Set<Permission>> {
		let row = await db.findOne(this.table, { where: { id: roleId } });
		if (!row) return new Set();
		return parsePermissions(row.permissions);
	}

	/**
	 * Reports whether a role grants every admin-defining permission.
	 * @param role - The role to test.
	 * @returns True when the role is an administrator role.
	 */
	static isAdminRole(role: RoleWithPermissions): boolean {
		return hasAll(new Set(role.permissions), ADMIN_PERMISSIONS);
	}

	/**
	 * Creates a custom role after validating its input and name uniqueness.
	 * @param db - Database handle.
	 * @param input - The role to create.
	 * @returns The created role with permissions.
	 * @throws {Role.InvalidError} On invalid input or a duplicate name.
	 */
	static async create(db: Database, input: RoleInput): Promise<RoleWithPermissions> {
		this.validate(input);
		if (await this.findByName(db, input.name)) {
			throw new this.InvalidError(`A role named "${input.name}" already exists.`);
		}
		let now = new Date().toISOString();
		let id = `role_${crypto.randomUUID()}`;
		await db.create(this.table, {
			id,
			name: input.name,
			label: input.label,
			description: input.description ?? "",
			permissions: JSON.stringify(this.dedupe(input.permissions)),
			builtin: 0,
			created_at: now,
			updated_at: now,
		});
		let created = await this.findById(db, id);
		if (!created) throw new this.InvalidError("Failed to create role.");
		return created;
	}

	/**
	 * Updates a role. Built-in roles keep their name and permission set; only their
	 * label and description can change.
	 * @param db - Database handle.
	 * @param id - The role id to update.
	 * @param input - The new role values.
	 * @returns The updated role with permissions.
	 * @throws {Role.InvalidError} When not found or the input is invalid.
	 */
	static async update(db: Database, id: string, input: RoleInput): Promise<RoleWithPermissions> {
		let existing = await this.findById(db, id);
		if (!existing) throw new this.InvalidError("Role not found.");
		this.validate(input);

		await db.update(
			this.table,
			{ id },
			{
				name: existing.builtin ? existing.name : input.name,
				label: input.label,
				description: input.description ?? "",
				permissions: existing.builtin
					? JSON.stringify(existing.permissions)
					: JSON.stringify(this.dedupe(input.permissions)),
				updated_at: new Date().toISOString(),
			},
		);
		let updated = await this.findById(db, id);
		if (!updated) throw new this.InvalidError("Failed to update role.");
		return updated;
	}

	/**
	 * Deletes a custom role; the caller is responsible for reassigning its users
	 * first. No-op when the role is missing.
	 * @param db - Database handle.
	 * @param id - The role id to delete.
	 * @throws {Role.InvalidError} When the target is a built-in role.
	 */
	static async destroy(db: Database, id: string): Promise<void> {
		let role = await this.findById(db, id);
		if (!role) return;
		if (role.builtin) throw new this.InvalidError("Built-in roles cannot be deleted.");
		await db.delete(this.table, { id });
	}

	/**
	 * Validates a role input: non-empty name and label, and only catalog permissions.
	 * @param input - The role input to validate.
	 * @throws {Role.InvalidError} On the first rule violation.
	 */
	private static validate(input: RoleInput): void {
		if (!input.name.trim()) throw new this.InvalidError("Role name is required.");
		if (!input.label.trim()) throw new this.InvalidError("Role label is required.");
		for (let key of input.permissions) {
			if (!PERMISSION_KEYS.includes(key)) {
				throw new this.InvalidError(`Unknown permission "${key}".`);
			}
		}
	}

	private static dedupe(permissions: Permission[]): Permission[] {
		return [...new Set(permissions)];
	}

	private static toRole(row: SelectRole): RoleWithPermissions {
		return {
			id: row.id,
			name: row.name,
			label: row.label,
			description: row.description,
			permissions: [...parsePermissions(row.permissions)],
			builtin: row.builtin === 1,
		};
	}
}
