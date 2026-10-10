/**
 * Data model for tenant member invitations: the control-plane record of an
 * invitation to administer a tenant's dashboard by email, for an address with no
 * platform dashboard account yet — the gap the direct-grant `POST
 * /tenants/:tenantId/members` route leaves open, since that route requires an
 * already-known `subjectId`. Wraps the `tenant_member_invitations` D1 table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v7";
import { and, column as c, eq, gt, isNull, table } from "remix/data-table";

/** A tenant member invitation's role, the same vocabulary a direct-grant membership carries. */
export type TenantMemberInvitationRole = "owner" | "admin" | "member";

/** Mints a `meminv_` TypeID for a new tenant member invitation row. */
const tenantMemberInvitationId = typeid("meminv");

/** One tenant member invitation row as the control plane stores it. */
export type TenantMemberInvitationRow = TableRow<typeof TenantMemberInvitation.table>;

/**
 * Active-record–style model for tenant member invitations, exposing static query
 * and mutation helpers over the `tenant_member_invitations` table.
 *
 * @example
 * let invitation = await TenantMemberInvitation.create(db, { tenantId, email, role, tokenHash, invitedBy, expiresAt });
 */
export default class TenantMemberInvitation {
	/** The `tenant_member_invitations` D1 table definition. */
	static table = table({
		name: "tenant_member_invitations",
		primaryKey: ["id"],
		columns: {
			id: c.text(),
			tenant_id: c.text(),
			email: c.text(),
			role: c.enum(["owner", "admin", "member"] as const),
			token_hash: c.text(),
			invited_by: c.text(),
			expires_at: c.integer(),
			accepted_at: c.integer().nullable(),
			created_at: c.integer(),
		},
	});

	/**
	 * Mints a new invitation row.
	 *
	 * @param db - Database connection.
	 * @param data - The tenant and folded email the invitation names, the role it
	 * offers, its token's hash, who sent it, and when it expires.
	 * @returns A promise resolving to the newly-created invitation row.
	 */
	static create(
		db: Database,
		data: {
			tenantId: string;
			email: string;
			role: TenantMemberInvitationRole;
			tokenHash: string;
			invitedBy: string;
			expiresAt: number;
		},
	): Promise<TenantMemberInvitationRow> {
		return db.create(
			TenantMemberInvitation.table,
			{
				id: tenantMemberInvitationId(generateUUID()).toString(),
				tenant_id: data.tenantId,
				email: data.email,
				role: data.role,
				token_hash: data.tokenHash,
				invited_by: data.invitedBy,
				expires_at: data.expiresAt,
				accepted_at: null,
				created_at: Date.now(),
			},
			{ returnRow: true },
		);
	}

	/**
	 * Finds an invitation by its token's hash. Spends nothing itself — a lookup
	 * only, since spending an invitation is the accept endpoint's own job.
	 *
	 * @param db - Database connection.
	 * @param tokenHash - The presented token's hash.
	 * @returns A promise resolving to the row, or null when no such invitation exists.
	 */
	static findByToken(db: Database, tokenHash: string): Promise<TenantMemberInvitationRow | null> {
		return db.findOne(TenantMemberInvitation.table, { where: { token_hash: tokenHash } });
	}

	/**
	 * Finds a tenant's own open invitation for an address, if one is outstanding.
	 *
	 * @param db - Database connection.
	 * @param tenantId - The tenant id.
	 * @param email - The folded email address.
	 * @returns A promise resolving to the open invitation row, or null when the
	 * address holds none.
	 */
	static findPendingByTenantAndEmail(
		db: Database,
		tenantId: string,
		email: string,
	): Promise<TenantMemberInvitationRow | null> {
		return db.findOne(TenantMemberInvitation.table, {
			where: and(eq("tenant_id", tenantId), eq("email", email), isNull("accepted_at")),
		});
	}

	/**
	 * Deletes every open invitation a tenant holds for an address, so a fresh
	 * invitation supersedes rather than piling up beside an outstanding one — the
	 * same delete-before-insert idiom `magic_link_attempts` already follows for its
	 * own outstanding attempt.
	 *
	 * @param db - Database connection.
	 * @param tenantId - The tenant id.
	 * @param email - The folded email address.
	 * @returns A promise that resolves once every open invitation for the address
	 * is gone.
	 */
	static async deletePendingByTenantAndEmail(
		db: Database,
		tenantId: string,
		email: string,
	): Promise<void> {
		await db.deleteMany(TenantMemberInvitation.table, {
			where: and(eq("tenant_id", tenantId), eq("email", email), isNull("accepted_at")),
		});
	}

	/**
	 * Spends an invitation by its token's hash, in the single conditional write
	 * that marks it accepted only when it is still open and unexpired — the same
	 * idiom `magic_link_attempts`'s own completion already follows, so two
	 * accept calls racing the same token can never both win.
	 *
	 * @param db - Database connection.
	 * @param data - The presented token's hash, and the clock to measure expiry
	 * against.
	 * @returns A promise resolving to the accepted row, or null for a token that
	 * does not resolve to a still-open, unexpired invitation — unknown, already
	 * accepted and expired alike.
	 */
	static async accept(
		db: Database,
		data: { tokenHash: string; now: number },
	): Promise<TenantMemberInvitationRow | null> {
		let spent = await db
			.query(TenantMemberInvitation.table)
			.where(
				and(eq("token_hash", data.tokenHash), isNull("accepted_at"), gt("expires_at", data.now)),
			)
			.update({ accepted_at: data.now }, { returning: "*" });

		return "rows" in spent ? (spent.rows[0] ?? null) : null;
	}
}
