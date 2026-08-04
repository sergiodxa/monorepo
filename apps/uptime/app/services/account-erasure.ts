/**
 * What deleting an account actually does, and what a person is told it will do before they
 * ask for it. {@link planAccountErasure} answers the second — which teams disappear and how
 * many other people lose access with them — and {@link eraseAccount} performs the first, for
 * the daily sweep that works through the queue.
 *
 * ## The ownership rule
 *
 * Membership is not ownership. A subject who merely belongs to a team loses their membership
 * and the team carries on without them; a subject who *owns* a team takes the team with them,
 * including every other member's access to it. There is no owner-transfer feature in this app —
 * `teams.owner_id` is written when the team is created and by nothing afterwards — so "delete
 * the owner but keep the team" is not a state this schema can express, and offering it as
 * advice ("hand the team over first") would send people to a page that cannot do it. The plan
 * therefore names the teams that will be destroyed and counts the people who will lose them,
 * and the confirmation says so plainly.
 *
 * ## Billing is cancelled first, and the run stops if it cannot be
 *
 * The owner's subject id is the billing identity in three places — `subscriptions
 * .external_customer_id`, the ping meter's `externalCustomerId`, and checkout's owner check —
 * so an owner whose data is deleted while their subscription lives keeps being charged for
 * teams that no longer exist, with no surface left to cancel from: checkout and the customer
 * portal are reached from a team's billing page, and that page requires being the team's owner.
 * The failure in the other order is recoverable by comparison — a cancelled subscription with
 * the data still present is a person who is no longer billed and whose deletion runs tomorrow.
 * So cancellation happens first and a failure aborts the whole erasure.
 *
 * That is also why this module talks to `PolarClient` directly instead of calling
 * `Customer.cancelSubscriptions`, which swallows every Polar error by design (a Polar outage
 * must not block deleting a *team*). Swallowing is the wrong contract here, because it makes
 * "still being billed" indistinguishable from "cancelled", and the whole point of the ordering
 * is to be able to tell those apart and stop.
 *
 * ## The other members are snapshotted, not looked up
 *
 * Destroying a team destroys the membership rows that say who was in it, so the people who lose
 * access can only be identified while the team still exists. {@link eraseAccount} therefore reads
 * each owned team's other members immediately before deleting it and reports them in
 * {@link AccountErasureReport.deletedTeams}, purely so the sweep can tell them. Doing it after the
 * fact is not a worse ordering, it is an impossible one.
 *
 * ## Every step is idempotent
 *
 * A run that failed halfway has already deleted some of the account, and the queued row that
 * survived means the same work runs again tomorrow. So nothing here may assume a first
 * attempt: revoking an already-revoked subscription is a no-op because the list of *active*
 * subscriptions is empty, a team that is already gone is skipped rather than deleted twice,
 * and every remaining delete is a `DELETE … WHERE` that matches nothing on a second pass.
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
 * What deleting this account would do, in the terms the confirmation has to state.
 *
 * Counts rather than identities for the other members: the number is what makes the warning
 * concrete ("four people lose access to Acme"), and naming them would put other people's
 * personal data into a page about erasing one's own.
 */
export interface AccountErasurePlan {
	ownedTeams: OwnedTeamImpact[];
	joinedTeams: JoinedTeamImpact[];
	/** Everyone other than the subject who loses a team, summed across the owned teams. */
	othersLosingAccess: number;
}

/**
 * One destroyed team and the people who lost it, snapshotted so they can be told.
 *
 * Only the team's display name and the other members' subject ids: the name is what makes the
 * notice mean anything to a reader, and the ids are all that is needed to ask the identity
 * provider for an address. The erased subject is excluded — they get their own confirmation, and
 * a notice blaming them by name or address would put a deleted person's personal data into
 * somebody else's mailbox.
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
	 * The destroyed teams that had other members, for the sweep to notify.
	 *
	 * Empty for the common case of a personal team nobody else joined, and empty on a re-run of
	 * an already-erased account — the membership rows this is read from are gone by then, which
	 * is exactly why it is captured here, before the delete, rather than looked up afterwards.
	 */
	deletedTeams: DeletedTeamNotice[];
}

/**
 * Assembles the warning shown before anything is deleted.
 *
 * Reads the subject's memberships and splits them on `owner_id`, which is the only fact that
 * decides whether a team survives. An owned team's `otherMemberCount` excludes the subject
 * themselves, so a personal team nobody else joined reports `0` and produces no warning at
 * all — most accounts are that case, and a confirmation that cried wolf on every one of them
 * would train people to ignore the one that matters.
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
 * Cancels billing and then erases the account, in that order, aborting if billing cannot be
 * cancelled.
 *
 * Returns a failure rather than throwing so the sweep can leave the queued row in place and
 * move on to the next one: the row surviving *is* the retry, and a thrown error would end the
 * run for everybody behind this person in the queue.
 *
 * Does **not** remove the queued row. That is the caller's last step, taken only once the
 * confirmation mail has been accepted, because the row is the only thing that remembers the
 * address the mail goes to.
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
			 * Who else is in this team is read *before* the delete and never after. The membership
			 * rows are the only record of it and `Team.deleteById` removes them, so a caller that
			 * wanted to tell those people anything would have nobody left to tell.
			 */
			let others = (await Team.listMembersByTeam(db, team.id))
				.map((member) => member.subject_id)
				.filter((memberId) => memberId !== subjectId);

			// Removes every membership on the team along with its monitors, alerts, status
			// pages, keys and invites — which is what makes the other members lose access.
			await Team.deleteById(db, team.id);
			teamsDeleted++;
			if (others.length > 0) deletedTeams.push({ teamName: team.name, memberIds: others });
			continue;
		}

		await Team.removeMembership(db, team.id, subjectId);
		membershipsRemoved++;
	}

	// The local projection of Polar's state. Revoking upstream leaves a row saying "revoked",
	// which is a record about a person who no longer exists; the invoices Polar keeps are the
	// ones that have to survive, and they are not here.
	await db.deleteMany(subscriptions, { where: { external_customer_id: subjectId } });

	await db.deleteMany(userPreferences, { where: { subject_id: subjectId } });

	// Pending invitations mentioning this person, in either direction. One addressed to their
	// address is their own personal data sitting in somebody else's team; one they sent carries
	// their subject id and is an offer from an account that is being deleted, so neither should
	// outlive them. Accepted invites are already gone — accepting one writes a membership and
	// the acceptance row is not what grants access.
	await db.deleteMany(invites, { where: { email } });
	await db.deleteMany(invites, { where: { sender_id: subjectId } });

	// If this address ever tried the public trial, the lead and its watches go too. `forget` is
	// the same hard delete an unsubscribe performs, and it is a no-op when there is no lead.
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
 * Revokes every active subscription the subject holds, and reports how many.
 *
 * Idempotent by construction: only *active* subscriptions are listed, so a second pass over an
 * already-cancelled account revokes nothing and succeeds with `0`. A Polar error is returned as
 * a failure, which is what aborts the erasure — see this module's docblock for why that is the
 * safe direction.
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
