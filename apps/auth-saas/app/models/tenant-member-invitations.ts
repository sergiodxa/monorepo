/**
 * Tenant member invitations: an invitation to administer a tenant's dashboard by email, for
 * an address with no platform dashboard account yet. A tenant holds at most one open
 * invitation per address, and accepting spends one in a single conditional write.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";
import type { TableRow } from "remix/data-table";

import { createModel } from "@sdxc/data-model";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v7";
import { and, eq, gt, isNull } from "remix/data-table";

import { tenantMemberInvitations } from "~/database/schema";

/** A tenant member invitation's role, the same vocabulary a direct-grant membership carries. */
export type TenantMemberInvitationRole = "owner" | "admin" | "member";

/** Mints a `meminv_` TypeID for a new tenant member invitation row. */
const tenantMemberInvitationId = typeid("meminv");

/**
 * Invitations, keyed by a minted id and found by their token's hash.
 *
 * @example let invitation = await models.tenantMemberInvitations.create({ tenant_id, email, role, token_hash, invited_by, expires_at });
 */
export const TenantMemberInvitations = createModel(tenantMemberInvitations, {
	optional: ["id"],

	scopes: {
		/** A tenant's open invitations for one folded address. */
		pendingFor: (query, tenantId: string, email: string) =>
			query.where(and(eq("tenant_id", tenantId), eq("email", email), isNull("accepted_at"))),
	},

	methods: {
		/** A lookup by the presented token's hash; accepting is `accept`'s job. */
		findByToken(tokenHash: string) {
			return this.findBy({ token_hash: tokenHash });
		},

		/**
		 * Spends an invitation in one conditional write that marks it accepted only while it is
		 * open and unexpired, so two accept calls racing the same token never both win.
		 *
		 * @returns The accepted row, or `null` for an unknown, accepted or expired token alike.
		 */
		async accept(input: {
			tokenHash: string;
			now: number;
		}): Promise<TableRow<typeof tenantMemberInvitations> | null> {
			let spent = await this.db
				.query(tenantMemberInvitations)
				.where(
					and(
						eq("token_hash", input.tokenHash),
						isNull("accepted_at"),
						gt("expires_at", input.now),
					),
				)
				.update({ accepted_at: input.now }, { returning: "*" });

			return "rows" in spent ? (spent.rows[0] ?? null) : null;
		},
	},

	callbacks: {
		async beforeCreate(values) {
			return {
				...values,
				id: values.id ?? tenantMemberInvitationId(generateUUID()).toString(),
				created_at: values.created_at ?? Date.now(),
			};
		},
	},
});

/** One tenant member invitation row as the control plane stores it. */
export type TenantMemberInvitationRow = ModelRow<typeof TenantMemberInvitations>;

export default TenantMemberInvitations;
