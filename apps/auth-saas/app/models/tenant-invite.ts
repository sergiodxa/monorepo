/**
 * Data model for pending team invitations to a tenant. Wraps the `tenant_invites` D1
 * table; invites are addressed by email, carry a role, and are marked accepted when the
 * recipient joins the tenant.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { column as c, table } from "remix/data-table";

import { RecordNotFoundError } from "~/app/lib/db-errors";

import type { TenantMemberRole } from "./tenant-member";

/**
 * TenantInvite model for pending team invitations.
 * Invites are sent by email and can be accepted by the recipient.
 *
 * @example
 * let pending = await TenantInvite.listPendingByTenant(db, tenantId);
 */
export default class TenantInvite {
	/** The `tenant_invites` D1 table definition (columns, primary key, timestamps). */
	static table = table({
		name: "tenant_invites",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: c.text(),
			tenant_id: c.text(),
			sender_subject_id: c.text(),
			email: c.text(),
			role: c.enum(["admin", "viewer"]),
			accepted_at: c.text().nullable(),
			created_at: c.text(),
			updated_at: c.text(),
		},
	});

	/**
	 * Lists all pending invites for a tenant.
	 * @param db - Database connection.
	 * @param tenantId - The tenant ID.
	 * @returns A promise resolving to the tenant's unaccepted invite rows.
	 */
	static listPendingByTenant(db: Database, tenantId: string) {
		return db.findMany(TenantInvite.table, {
			where: { tenant_id: tenantId, accepted_at: null },
		});
	}

	/**
	 * Lists all pending invites for an email address.
	 * @param db - Database connection.
	 * @param email - The email address.
	 * @returns A promise resolving to the unaccepted invite rows for that email.
	 */
	static listPendingByEmail(db: Database, email: string) {
		return db.findMany(TenantInvite.table, {
			where: { email, accepted_at: null },
		});
	}

	/**
	 * Finds an invite by ID.
	 * @param db - Database connection.
	 * @param id - The invite ID.
	 * @returns A promise resolving to the invite row, or null when not found.
	 */
	static show(db: Database, id: string) {
		return db.findOne(TenantInvite.table, { where: { id } });
	}

	/**
	 * Finds a pending invite by tenant and email.
	 * @param db - Database connection.
	 * @param tenantId - The tenant ID.
	 * @param email - The email address.
	 * @returns A promise resolving to the matching pending invite, or null when none.
	 */
	static findPendingByTenantAndEmail(db: Database, tenantId: string, email: string) {
		return db.findOne(TenantInvite.table, {
			where: { tenant_id: tenantId, email, accepted_at: null },
		});
	}

	/**
	 * Creates a new invite.
	 * @param db - Database connection.
	 * @param data - Invite data.
	 * @returns A promise resolving to the newly-created invite row.
	 */
	static async create(
		db: Database,
		data: {
			tenantId: string;
			senderSubjectId: string;
			email: string;
			role: TenantMemberRole;
		},
	) {
		let id = crypto.randomUUID();
		let now = new Date().toISOString();

		await db.create(TenantInvite.table, {
			id,
			tenant_id: data.tenantId,
			sender_subject_id: data.senderSubjectId,
			email: data.email,
			role: data.role,
			accepted_at: null,
			created_at: now,
			updated_at: now,
		});

		return (await db.findOne(TenantInvite.table, { where: { id } }))!;
	}

	/**
	 * Marks an invite as accepted.
	 * @param db - Database connection.
	 * @param id - The invite ID.
	 * @returns A promise resolving to the updated (accepted) invite row.
	 * @throws {RecordNotFoundError} When no invite exists for the given id.
	 */
	static async accept(db: Database, id: string) {
		let invite = await db.findOne(TenantInvite.table, { where: { id } });
		if (!invite) throw new RecordNotFoundError(TenantInvite.table, { id });

		let now = new Date().toISOString();
		await db.update(
			TenantInvite.table,
			{ id },
			{
				accepted_at: now,
				updated_at: now,
			},
		);

		return (await db.findOne(TenantInvite.table, { where: { id } }))!;
	}

	/**
	 * Deletes an invite (cancel or cleanup).
	 * @param db - Database connection.
	 * @param id - The invite ID.
	 * @returns A promise resolving to the D1 delete result.
	 * @throws {RecordNotFoundError} When no invite exists for the given id.
	 */
	static async destroy(db: Database, id: string) {
		let invite = await db.findOne(TenantInvite.table, { where: { id } });
		if (!invite) throw new RecordNotFoundError(TenantInvite.table, { id });
		return db.delete(TenantInvite.table, { id });
	}
}
