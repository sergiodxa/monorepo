import type { Database } from "remix/data-table";

import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

import { RecordNotFoundError } from "~/lib/db-errors";

/** Roles for tenant team members. */
export type TenantMemberRole = "admin" | "viewer";

/**
 * TenantMember model for managing team access to tenants.
 * Members can have admin (full access except billing) or viewer (read-only) roles.
 * Owners are stored in the tenants table, not here.
 */
export default class TenantMember {
	static table = createTable({
		name: "tenant_members",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: s.string(),
			tenant_id: s.string(),
			subject_id: s.string(),
			role: s.enum_(["admin", "viewer"]),
			created_at: s.string(),
			updated_at: s.string(),
		},
	});

	/**
	 * Lists all members of a tenant.
	 * @param db - Database connection.
	 * @param tenantId - The tenant ID.
	 */
	static listByTenant(db: Database, tenantId: string) {
		return db.findMany(TenantMember.table, { where: { tenant_id: tenantId } });
	}

	/**
	 * Lists all tenants a subject is a member of.
	 * @param db - Database connection.
	 * @param subjectId - The subject ID.
	 */
	static listBySubject(db: Database, subjectId: string) {
		return db.findMany(TenantMember.table, { where: { subject_id: subjectId } });
	}

	/**
	 * Finds a membership by tenant and subject.
	 * @param db - Database connection.
	 * @param tenantId - The tenant ID.
	 * @param subjectId - The subject ID.
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
	 */
	static async destroy(db: Database, id: string) {
		let member = await db.findOne(TenantMember.table, { where: { id } });
		if (!member) throw new RecordNotFoundError(TenantMember.table, { id });
		return db.delete(TenantMember.table, { id });
	}
}
