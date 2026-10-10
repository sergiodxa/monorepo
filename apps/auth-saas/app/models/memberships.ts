/**
 * Tenant memberships: who may administer a tenant, and at what role. Ownership is a membership
 * like any other, so "every tenant this subject may administer" is one indexed read, and every
 * role change or removal keeps at least one owner on the tenant.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { TableRow } from "remix/data-table";

import { createModel, NotFound } from "@sdxc/data-model";
import { failure, success } from "@sdxc/result";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v7";
import { inList, sql } from "remix/data-table";

import { memberships, tenants } from "~/database/schema";

import type { TenantRow } from "./tenants";

/** A tenant membership's role. */
export type MembershipRole = "owner" | "admin" | "member";

/** Mints a `mem_` TypeID for a new membership row. */
const membershipId = typeid("mem");

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
 * Memberships. `changeRole` and `revoke` check the owner count inside their one statement,
 * so two concurrent demotions or removals of a tenant's last two owners leave one standing.
 *
 * @example let membership = await models.memberships.findByTenantAndSubject(tenantId, subjectId);
 */
export const Memberships = createModel(memberships, {
	optional: ["id"],

	scopes: {
		ofTenant: (query, tenantId: string) => query.where({ tenant_id: tenantId }),
		ofSubject: (query, subjectId: string) => query.where({ subject_id: subjectId }),
	},

	methods: {
		/** A subject's membership of a tenant, or `null` when the subject has no access to it. */
		findByTenantAndSubject(tenantId: string, subjectId: string) {
			return this.findBy({ tenant_id: tenantId, subject_id: subjectId });
		},

		/**
		 * Changes a membership's role, refusing to demote the tenant's last owner.
		 *
		 * @returns The updated row, `LastOwnerError` for the last owner, or `NotFound`.
		 */
		async changeRole(
			id: string,
			role: MembershipRole,
		): Promise<Result<MembershipRow, LastOwnerError | NotFound>> {
			await this.db.exec(sql`
				UPDATE memberships SET role = ${role}, updated_at = ${this.db.now()}
				WHERE id = ${id} AND (role != 'owner' OR ${role} = 'owner' OR EXISTS (
					SELECT 1 FROM memberships AS other
					WHERE other.tenant_id = memberships.tenant_id
						AND other.role = 'owner'
						AND other.id != memberships.id
				))
			`);

			let row = await this.find(id);
			if (row === null) return failure(new NotFound("memberships", id));
			if (row.role !== role) return failure(new LastOwnerError(id));
			return success(row);
		},

		/**
		 * Revokes a subject's access to a tenant, refusing to remove its last owner.
		 *
		 * @returns Whether a row was deleted, or `LastOwnerError` for the last owner.
		 */
		async revoke(id: string): Promise<Result<boolean, LastOwnerError>> {
			let deleted = await this.db.exec(sql`
				DELETE FROM memberships
				WHERE id = ${id} AND (role != 'owner' OR EXISTS (
					SELECT 1 FROM memberships AS other
					WHERE other.tenant_id = memberships.tenant_id
						AND other.role = 'owner'
						AND other.id != memberships.id
				))
			`);

			if ((await this.find(id)) !== null) return failure(new LastOwnerError(id));
			return success(deleted.affectedRows === 1);
		},

		/**
		 * Every tenant a subject may administer with the role granting it, leaving out tenants
		 * whose row is a tombstone left behind by deletion.
		 */
		async administeredTenants(subjectId: string): Promise<AdministeredTenant[]> {
			let rows = await this.ofSubject(subjectId).all();
			if (rows.length === 0) return [];

			let found = await this.db.findMany(tenants, {
				where: inList(
					"id",
					rows.map((membership) => membership.tenant_id),
				),
			});
			let tenantsById = new Map(found.map((tenant) => [tenant.id, tenant]));

			let administered: AdministeredTenant[] = [];
			for (let membership of rows) {
				let tenant = tenantsById.get(membership.tenant_id);
				if (!tenant || tenant.status === "deleted") continue;
				administered.push({ tenant, role: membership.role });
			}
			return administered;
		},
	},

	callbacks: {
		async beforeCreate(values) {
			return { ...values, id: values.id ?? membershipId(generateUUID()).toString() };
		},
	},
});

/** One membership row as the control plane stores it. */
export type MembershipRow = TableRow<typeof memberships>;

export default Memberships;
