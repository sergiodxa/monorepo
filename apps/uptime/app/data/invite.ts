/**
 * Data-access model for team invites: create/revoke, accepting an invite (marking it
 * accepted and creating the resulting membership as two sequential writes, which is as
 * atomic as D1 gets), and the pending-invites list on the team settings page. Expiration
 * is a display-only notion the caller computes from `created_at`, so an invite stays
 * acceptable for as long as its row exists.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@pkg/uuid";
import { and, eq, isNull } from "remix/data-table";

import { invites, memberships } from "~/database/schema";

export default class Invite {
	/** Creates a pending invite for `email` on a team. */
	static async create(db: Database, teamId: string, senderId: string, email: string) {
		return await db.create(
			invites,
			{ id: generateUUID(), team_id: teamId, sender_id: senderId, email, accepted_at: null },
			{ touch: true, returnRow: true },
		);
	}

	/** Finds any invite (pending or accepted) for `email` on a team. */
	static async findByEmailForTeam(db: Database, teamId: string, email: string) {
		return await db.findOne(invites, { where: { team_id: teamId, email } });
	}

	/** Finds an invite within a team, or `null` when the id belongs to another team. */
	static async findByIdForTeam(db: Database, teamId: string, inviteId: string) {
		return await db.findOne(invites, { where: { id: inviteId, team_id: teamId } });
	}

	/** Finds an invite by id, for the public accept-invite page. */
	static async findById(db: Database, inviteId: string) {
		return await db.findOne(invites, { where: { id: inviteId } });
	}

	/** Lists a team's still-pending invites, most recently created first. */
	static async listPendingByTeam(db: Database, teamId: string) {
		return await db.findMany(invites, {
			where: and(eq("team_id", teamId), isNull("accepted_at")),
			orderBy: ["created_at", "desc"],
		});
	}

	/** Lists every invite for a team (pending and accepted), most recently created first. */
	static async listByTeam(db: Database, teamId: string) {
		return await db.findMany(invites, {
			where: { team_id: teamId },
			orderBy: ["created_at", "desc"],
		});
	}

	/** Marks an invite accepted and creates the resulting membership. */
	static async accept(db: Database, inviteId: string, teamId: string, subjectId: string) {
		await db.update(invites, inviteId, { accepted_at: Date.now() }, { touch: true });
		await db.create(
			memberships,
			{ id: generateUUID(), team_id: teamId, subject_id: subjectId, role: "member" },
			{ touch: true, returnRow: true },
		);
	}

	/** Revokes (deletes) a pending invite. */
	static async revoke(db: Database, inviteId: string) {
		await db.delete(invites, inviteId);
	}

	/** Deletes any pending invite matching `email` on a team, if one exists. */
	static async deleteByTeamAndEmail(db: Database, teamId: string, email: string) {
		let existing = await Invite.findByEmailForTeam(db, teamId, email);
		if (existing) await db.delete(invites, existing.id);
	}
}
