/**
 * Plans and performs account erasure for the daily deletion sweep. Owning a team destroys
 * it along with every other member's access, since this schema has no owner-transfer
 * feature; {@link planAccountErasure} previews that impact and {@link eraseAccount} performs
 * it, cancelling billing first so a failed cancellation aborts the whole run and keeps
 * billing accurate.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PolarClient } from "@pkg/polar";
import type { Result } from "@pkg/result";
import type { Database } from "remix/data-table";

import { failure, isFailure, success } from "@pkg/result";

import Lead from "~/app/data/lead";
import { SUBSCRIPTION_PRODUCT_ID } from "~/app/data/subscription";
import Team from "~/app/data/team";
import { invites, subscriptions, userPreferences } from "~/database/schema";

/** One team the subject owns, and therefore one team that deletion destroys. */
export interface OwnedTeamImpact {
	id: string;
	name: string;
	slug: string;
	/** Members other than the subject who lose access when this team goes. */
	otherMemberCount: number;
}

/** One team the subject belongs to but does not own, which survives their deletion. */
export interface JoinedTeamImpact {
	id: string;
	name: string;
	slug: string;
	role: "member" | "admin";
}

/**
 * What deleting this account would do, in the terms the confirmation has to state. The
 * other-member counts make the warning concrete while keeping other people's identities
 * out of a page about erasing one's own account.
 */
export interface AccountErasurePlan {
	ownedTeams: OwnedTeamImpact[];
	joinedTeams: JoinedTeamImpact[];
	/** Everyone other than the subject who loses a team, summed across the owned teams. */
	othersLosingAccess: number;
}

/**
 * One destroyed team and the people who lost it, snapshotted so they can be told. Carries
 * only the team name and the other members' subject ids, enough to ask the identity
 * provider for an address, and excludes the erased subject, who gets their own confirmation.
 */
export interface DeletedTeamNotice {
	/** Display name of the team that no longer exists. */
	teamName: string;
	/** Subjects other than the erased one who were members when it was deleted. */
	memberIds: string[];
}

/** What one completed erasure removed, for the sweep's log line. */
export interface AccountErasureReport {
	subjectId: string;
	/** Teams destroyed because the subject owned them. */
	teamsDeleted: number;
	/** Memberships given up in teams that survive. */
	membershipsRemoved: number;
	/** Polar subscriptions revoked on this run; `0` on a re-run of an already-cancelled account. */
	subscriptionsRevoked: number;
	/**
	 * The destroyed teams that had other members, for the sweep to notify. Empty for a
	 * personal team nobody else joined, and also empty on a re-run of an already-erased
	 * account, since the membership rows it reads from are already gone by then.
	 */
	deletedTeams: DeletedTeamNotice[];
}

/**
 * Assembles the warning shown before anything is deleted. Splits memberships on
 * `owner_id`, the only fact that decides whether a team survives; an owned team's
 * `otherMemberCount` excludes the subject, so a personal team nobody else joined warns for `0`.
 */
export async function planAccountErasure(
	db: Database,
	subjectId: string,
): Promise<AccountErasurePlan> {
	let memberships = await Team.listWithRoleBySubjectId(db, subjectId);

	let ownedTeams: OwnedTeamImpact[] = [];
	let joinedTeams: JoinedTeamImpact[] = [];

	for (let { team, role, isOwner } of memberships) {
		if (!isOwner) {
			joinedTeams.push({ id: team.id, name: team.name, slug: team.slug, role });
			continue;
		}

		let members = await Team.listMembersByTeam(db, team.id);
		ownedTeams.push({
			id: team.id,
			name: team.name,
			slug: team.slug,
			otherMemberCount: members.filter((member) => member.subject_id !== subjectId).length,
		});
	}

	return {
		ownedTeams,
		joinedTeams,
		othersLosingAccess: ownedTeams.reduce((total, team) => total + team.otherMemberCount, 0),
	};
}

/**
 * Cancels billing before erasing anything, aborting the whole run if billing cannot be
 * cancelled. Returns a failure instead of throwing, so the queued row survives as the retry;
 * the caller removes that row itself, once the confirmation mail is accepted.
 *
 * @param db - Database handle.
 * @param polar - Polar client, used only to revoke the subject's active subscriptions.
 * @param subjectId - The OIDC subject being erased.
 * @param email - The address captured with the request, used to find a trial lead to forget.
 */
export async function eraseAccount(
	db: Database,
	polar: PolarClient,
	subjectId: string,
	email: string,
): Promise<Result<AccountErasureReport, Error>> {
	let revoked = await cancelBilling(polar, subjectId);
	if (isFailure(revoked)) return revoked;

	let memberships = await Team.listWithRoleBySubjectId(db, subjectId);
	let teamsDeleted = 0;
	let membershipsRemoved = 0;
	let deletedTeams: DeletedTeamNotice[] = [];

	for (let { team, isOwner } of memberships) {
		if (isOwner) {
			/**
			 * Who else is in this team is read while the team still exists, since the membership rows
			 * are the only record of it and `Team.deleteById` removes them along with everything else
			 * the team owns — which is what takes away their access.
			 */
			let others = (await Team.listMembersByTeam(db, team.id))
				.map((member) => member.subject_id)
				.filter((memberId) => memberId !== subjectId);

			await Team.deleteById(db, team.id);
			teamsDeleted++;
			if (others.length > 0) deletedTeams.push({ teamName: team.name, memberIds: others });
			continue;
		}

		await Team.removeMembership(db, team.id, subjectId);
		membershipsRemoved++;
	}

	/**
	 * The local projection of Polar's state. Revoking upstream leaves a row saying "revoked"
	 * about a person who no longer exists here, while the invoices that must survive stay on
	 * Polar's side.
	 */
	await db.deleteMany(subscriptions, { where: { external_customer_id: subjectId } });

	await db.deleteMany(userPreferences, { where: { subject_id: subjectId } });

	/**
	 * Pending invitations mentioning this person, in either direction: one addressed to them
	 * is personal data sitting in somebody else's team, and one they sent is an offer from an
	 * account being deleted. Accepted invites already vanished into a membership row.
	 */
	await db.deleteMany(invites, { where: { email } });
	await db.deleteMany(invites, { where: { sender_id: subjectId } });

	/**
	 * A trial lead tied to this address is forgotten too, so erasure reaches data captured
	 * before any account existed. `forget` performs the same hard delete an unsubscribe does.
	 */
	let lead = await Lead.findByEmail(db, email);
	if (lead) await Lead.forget(db, lead.id);

	return success({
		subjectId,
		teamsDeleted,
		membershipsRemoved,
		subscriptionsRevoked: revoked.data,
		deletedTeams,
	});
}

/**
 * Revokes every active subscription the subject holds and reports how many. Idempotent by
 * construction: only *active* subscriptions are listed, so a second pass over an already-
 * cancelled account revokes nothing and succeeds with `0`.
 */
async function cancelBilling(
	polar: PolarClient,
	subjectId: string,
): Promise<Result<number, Error>> {
	try {
		let active = await polar.listActiveSubscriptions(subjectId, SUBSCRIPTION_PRODUCT_ID);
		for (let subscription of active) await polar.revokeSubscription(subscription.id);
		return success(active.length);
	} catch (error) {
		let cause = error instanceof Error ? error.message : String(error);
		return failure(new Error(`Could not cancel billing for ${subjectId}: ${cause}`));
	}
}
