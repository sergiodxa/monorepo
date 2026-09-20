/**
 * Data model for tenant memberships: who may administer a tenant, and at what role.
 * Ownership is a membership row like any other, including the owner's, so "every
 * tenant this subject may administer" is one indexed read. Wraps the `memberships`
 * D1 table; `subject_id` names a subject inside the platform tenant's own object,
 * which is why it carries no foreign key.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";
import { column as c, inList, table } from "remix/data-table";

import type { TenantRow } from "./tenant";

import Tenant from "./tenant";

/** A tenant membership's role. */
export type MembershipRole = "owner" | "admin" | "member";

/** Mints a `mem_` TypeID for a new membership row. */
const membershipId = typeid("mem");

/** One membership row as the control plane stores it. */
export type MembershipRow = TableRow<typeof Membership.table>;

/** A tenant a subject may administer, paired with the role that grants access. */
export interface AdministeredTenant {
	tenant: TenantRow;
	role: MembershipRole;
}

/**
 * Active-record–style model for tenant memberships, exposing static query and
 * mutation helpers over the `memberships` table.
 *
 * @example
 * let membership = await Membership.findByTenantAndSubject(db, tenantId, subjectId);
 */
export default class Membership {
	/** The `memberships` D1 table definition (columns, primary key, timestamps). */
	static table = table({
		name: "memberships",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: c.text(),
			tenant_id: c.text(),
			subject_id: c.text(),
			role: c.enum(["owner", "admin", "member"] as const),
			created_at: c.integer(),
			updated_at: c.integer(),
		},
	});

	/**
	 * Lists every membership of a tenant.
	 *
	 * @param db - Database connection.
	 * @param tenantId - The tenant id.
	 * @returns A promise resolving to the tenant's membership rows.
	 */
	static listByTenant(db: Database, tenantId: string): Promise<MembershipRow[]> {
		return db.findMany(Membership.table, { where: { tenant_id: tenantId } });
	}

	/**
	 * Finds a subject's membership of a tenant.
	 *
	 * @param db - Database connection.
	 * @param tenantId - The tenant id.
	 * @param subjectId - The subject id.
	 * @returns A promise resolving to the membership row, or null when the subject
	 * has no access to the tenant.
	 */
	static findByTenantAndSubject(
		db: Database,
		tenantId: string,
		subjectId: string,
	): Promise<MembershipRow | null> {
		return db.findOne(Membership.table, { where: { tenant_id: tenantId, subject_id: subjectId } });
	}

	/**
	 * Grants a subject access to a tenant at the given role.
	 *
	 * @param db - Database connection.
	 * @param data - The tenant, subject, and role the membership grants.
	 * @returns A promise resolving to the newly-created membership row.
	 */
	static create(
		db: Database,
		data: { tenantId: string; subjectId: string; role: MembershipRole },
	): Promise<MembershipRow> {
		return db.create(
			Membership.table,
			{
				id: membershipId(generateUUID()).toString(),
				tenant_id: data.tenantId,
				subject_id: data.subjectId,
				role: data.role,
			},
			{ touch: true, returnRow: true },
		);
	}

	/**
	 * Changes a membership's role.
	 *
	 * @param db - Database connection.
	 * @param id - The membership id.
	 * @param role - The role to assign.
	 * @returns A promise resolving to the updated membership row.
	 * @throws When no membership exists for the given id.
	 */
	static update(db: Database, id: string, role: MembershipRole): Promise<MembershipRow> {
		return db.update(Membership.table, { id }, { role }, { touch: true });
	}

	/**
	 * Revokes a subject's access to a tenant.
	 *
	 * @param db - Database connection.
	 * @param id - The membership id.
	 * @returns A promise resolving to whether a row was deleted.
	 */
	static delete(db: Database, id: string): Promise<boolean> {
		return db.delete(Membership.table, { id });
	}

	/**
	 * Lists every tenant a subject may administer, paired with the role that grants
	 * access, excluding tenants whose row is a tombstone left behind by deletion.
	 *
	 * @param db - Database connection.
	 * @param subjectId - The subject id.
	 * @returns A promise resolving to the subject's administered tenants.
	 * @example
	 * let administered = await Membership.administeredTenants(db, platformSession.subjectId);
	 */
	static async administeredTenants(db: Database, subjectId: string): Promise<AdministeredTenant[]> {
		let memberships = await db.findMany(Membership.table, { where: { subject_id: subjectId } });
		if (memberships.length === 0) return [];

		let tenants = await db.findMany(Tenant.table, {
			where: inList(
				"id",
				memberships.map((membership) => membership.tenant_id),
			),
		});
		let tenantsById = new Map(tenants.map((tenant) => [tenant.id, tenant]));

		let administered: AdministeredTenant[] = [];
		for (let membership of memberships) {
			let tenant = tenantsById.get(membership.tenant_id);
			if (!tenant || tenant.status === "deleted") continue;
			administered.push({ tenant, role: membership.role });
		}
		return administered;
	}
}
