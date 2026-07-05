import type { Database } from "remix/data-table";

import type { SelectRole } from "../../database/schema";
import type { Permission } from "../../shared/permissions";

import { roles } from "../../database/schema";
import {
	ADMIN_PERMISSIONS,
	hasAll,
	parsePermissions,
	PERMISSION_KEYS,
} from "../../shared/permissions";

/** A role with its permission set decoded from JSON. */
export interface RoleWithPermissions {
	id: string;
	name: string;
	label: string;
	description: string;
	permissions: Permission[];
	builtin: boolean;
}

/** Input for creating/updating a role. */
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

	/** Lists all roles. */
	static async findAll(db: Database): Promise<RoleWithPermissions[]> {
		let rows = await db.findMany(this.table);
		return rows.map((row) => this.toRole(row));
	}

	/** Finds a role by id. */
	static async findById(db: Database, id: string): Promise<RoleWithPermissions | null> {
		let row = await db.findOne(this.table, { where: { id } });
		return row ? this.toRole(row) : null;
	}

	/** Finds a role by machine name. */
	static async findByName(db: Database, name: string): Promise<RoleWithPermissions | null> {
		let row = await db.findOne(this.table, { where: { name } });
		return row ? this.toRole(row) : null;
	}

	/** The admin role id (used for first-admin bootstrap and the allowlist). */
	static async adminRoleId(db: Database): Promise<string> {
		let admin = await this.findByName(db, "admin");
		if (!admin) throw new this.InvalidError("Admin role missing (unseeded database).");
		return admin.id;
	}

	/** The reader role id (default for every user after the first admin). */
	static async readerRoleId(db: Database): Promise<string> {
		let reader = await this.findByName(db, "reader");
		if (!reader) throw new this.InvalidError("Reader role missing (unseeded database).");
		return reader.id;
	}

	/** Returns the permission set granted by a role (empty when missing). */
	static async permissionsFor(db: Database, roleId: string): Promise<Set<Permission>> {
		let row = await db.findOne(this.table, { where: { id: roleId } });
		if (!row) return new Set();
		return parsePermissions(row.permissions);
	}

	/** True when the role grants every admin-defining permission. */
	static isAdminRole(role: RoleWithPermissions): boolean {
		return hasAll(new Set(role.permissions), ADMIN_PERMISSIONS);
	}

	/** Creates a custom role. */
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

	/** Deletes a custom role (built-ins cannot be deleted; caller reassigns users). */
	static async destroy(db: Database, id: string): Promise<void> {
		let role = await this.findById(db, id);
		if (!role) return;
		if (role.builtin) throw new this.InvalidError("Built-in roles cannot be deleted.");
		await db.delete(this.table, { id });
	}

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
