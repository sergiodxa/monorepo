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

import type { Result } from "@sdxc/result";
import type { Database, TableRow } from "remix/data-table";

import { failure, success } from "@sdxc/result";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v7";
import { column as c, inList, sql, table } from "remix/data-table";

import { RecordNotFoundError } from "~/app/lib/db-errors";

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
 * Refuses a write that would leave a tenant with no owner: only an owner holds
 * `members:write`, so a tenant without one has nobody left able to appoint one.
 */
export class LastOwnerError extends Error {
	override name = "LastOwnerError";

	/**
	 * @param membershipId - The tenant's last owner membership the write named.
	 */
	constructor(public readonly membershipId: string) {
		super(`Membership ${membershipId} is its tenant's last owner`);
	}
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
	 * Changes a membership's role, refusing to demote the tenant's last owner. The
	 * owner count is checked inside the one `UPDATE`, so two concurrent demotions
	 * of a tenant's last two owners leave exactly one of them standing.
	 *
	 * @param db - Database connection.
	 * @param id - The membership id.
	 * @param role - The role to assign.
	 * @returns The updated membership row, or why it was left unchanged.
	 */
	static async update(
		db: Database,
		id: string,
		role: MembershipRole,
	): Promise<Result<MembershipRow, LastOwnerError | RecordNotFoundError<typeof Membership.table>>> {
		await db.exec(sql`
			UPDATE memberships SET role = ${role}, updated_at = ${Date.now()}
			WHERE id = ${id} AND (role != 'owner' OR ${role} = 'owner' OR EXISTS (
				SELECT 1 FROM memberships AS other
				WHERE other.tenant_id = memberships.tenant_id
					AND other.role = 'owner'
					AND other.id != memberships.id
			))
		`);

		let row = await db.find(Membership.table, { id });
		if (!row) return failure(new RecordNotFoundError(Membership.table, { id }));
		if (row.role !== role) return failure(new LastOwnerError(id));
		return success(row);
	}

	/**
	 * Revokes a subject's access to a tenant, refusing to remove its last owner. The
	 * owner count is checked inside the one `DELETE`, so two concurrent removals of
	 * a tenant's last two owners leave exactly one of them standing.
	 *
	 * @param db - Database connection.
	 * @param id - The membership id.
	 * @returns Whether a row was deleted, or that it is the tenant's last owner.
	 */
	static async delete(db: Database, id: string): Promise<Result<boolean, LastOwnerError>> {
		let deleted = await db.exec(sql`
			DELETE FROM memberships
			WHERE id = ${id} AND (role != 'owner' OR EXISTS (
				SELECT 1 FROM memberships AS other
				WHERE other.tenant_id = memberships.tenant_id
					AND other.role = 'owner'
					AND other.id != memberships.id
			))
		`);

		if (await db.find(Membership.table, { id })) return failure(new LastOwnerError(id));
		return success(deleted.affectedRows === 1);
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
