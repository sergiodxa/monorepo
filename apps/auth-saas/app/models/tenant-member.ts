/**
 * Data model for tenant team membership. Wraps the `tenant_members` D1 table, which
 * grants non-owner subjects `admin` or `viewer` access to a tenant. Tenant owners live
 * in the `tenants` table, not here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { column as c, table } from "remix/data-table";

import { RecordNotFoundError } from "~/app/lib/db-errors";

/** Roles for tenant team members. */
export type TenantMemberRole = "admin" | "viewer";

/**
 * TenantMember model for managing team access to tenants.
 * Members can have admin (full access except billing) or viewer (read-only) roles.
 * Owners are stored in the tenants table, not here.
 *
 * @example
 * let members = await TenantMember.listByTenant(db, tenantId);
 */
export default class TenantMember {
	/** The `tenant_members` D1 table definition (columns, primary key, timestamps). */
	static table = table({
		name: "tenant_members",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: c.text(),
			tenant_id: c.text(),
			subject_id: c.text(),
			role: c.enum(["admin", "viewer"]),
			created_at: c.text(),
			updated_at: c.text(),
		},
	});

	/**
	 * Lists all members of a tenant.
	 * @param db - Database connection.
	 * @param tenantId - The tenant ID.
	 * @returns A promise resolving to the tenant's member rows.
	 */
	static listByTenant(db: Database, tenantId: string) {
		return db.findMany(TenantMember.table, { where: { tenant_id: tenantId } });
	}

	/**
	 * Lists all tenants a subject is a member of.
	 * @param db - Database connection.
	 * @param subjectId - The subject ID.
	 * @returns A promise resolving to the membership rows for that subject.
	 */
	static listBySubject(db: Database, subjectId: string) {
		return db.findMany(TenantMember.table, { where: { subject_id: subjectId } });
	}

	/**
	 * Finds a membership by tenant and subject.
	 * @param db - Database connection.
	 * @param tenantId - The tenant ID.
	 * @param subjectId - The subject ID.
	 * @returns A promise resolving to the membership row, or null when none exists.
	 */
	static findByTenantAndSubject(db: Database, tenantId: string, subjectId: string) {
		return db.findOne(TenantMember.table, {
			where: { tenant_id: tenantId, subject_id: subjectId },
		});
	}

	/**
	 * Creates a new tenant membership.
	 * @param db - Database connection.
	 * @param data - Membership data.
	 * @returns A promise resolving to the newly-created membership row.
	 */
	static async create(
		db: Database,
		data: {
			tenantId: string;
			subjectId: string;
			role: TenantMemberRole;
		},
	) {
		let id = crypto.randomUUID();
		let now = new Date().toISOString();

		await db.create(TenantMember.table, {
			id,
			tenant_id: data.tenantId,
			subject_id: data.subjectId,
			role: data.role,
			created_at: now,
			updated_at: now,
		});

		return (await db.findOne(TenantMember.table, { where: { id } }))!;
	}

	/**
	 * Updates a member's role.
	 * @param db - Database connection.
	 * @param id - The membership ID.
	 * @param role - The new role.
	 * @returns A promise resolving to the updated membership row.
	 * @throws {RecordNotFoundError} When no membership exists for the given id.
	 */
	static async updateRole(db: Database, id: string, role: TenantMemberRole) {
		let member = await db.findOne(TenantMember.table, { where: { id } });
		if (!member) throw new RecordNotFoundError(TenantMember.table, { id });

		await db.update(
			TenantMember.table,
			{ id },
			{
				role,
				updated_at: new Date().toISOString(),
			},
		);

		return (await db.findOne(TenantMember.table, { where: { id } }))!;
	}

	/**
	 * Removes a member from a tenant.
	 * @param db - Database connection.
	 * @param id - The membership ID.
	 * @returns A promise resolving to the D1 delete result.
	 * @throws {RecordNotFoundError} When no membership exists for the given id.
	 */
	static async destroy(db: Database, id: string) {
		let member = await db.findOne(TenantMember.table, { where: { id } });
		if (!member) throw new RecordNotFoundError(TenantMember.table, { id });
		return db.delete(TenantMember.table, { id });
	}
}
