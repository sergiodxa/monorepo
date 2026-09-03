/**
 * Daily sweep over the account-deletion queue: cancels billing, deletes the data, mails
 * the confirmation, and only then removes the request row, which is itself the retry.
 * Billing goes first since cancelling it needs team ownership, a right the deletion
 * removes; the mail goes out before the row does since the row holds the only copy of
 * the address, and other members are notified best-effort as the row's removal proceeds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CurrentJobContext } from "@sdxc/jobs";

import { ManagementClient } from "@sdxc/auth/management-client";
import { createJobHandler } from "@sdxc/jobs";
import { Mailer } from "@sdxc/mail";
import { isFailure } from "@sdxc/result";
import { getServiceContainer } from "@sdxc/service-container";

import type { DeletedTeamNotice } from "~/app/services/account-erasure";
import type { SelectAccountDeletion } from "~/database/schema";

import AccountDeletion from "~/app/data/account-deletion";
import UserPreferences from "~/app/data/user-preferences";
import { AccountDeletedEmail } from "~/app/emails/account-deleted";
import { emailTranslator } from "~/app/emails/locale";
import { TeamDeletedEmail } from "~/app/emails/team-deleted";
import jobs from "~/app/jobs";
import { polar } from "~/app/lib/billing";
import { eraseAccount } from "~/app/services/account-erasure";
import { recordCost } from "~/app/services/cost";
import { resolveSubjects } from "~/app/services/subjects";

export default createJobHandler(jobs.deleteAccounts, async (ctx) => {
	let mailer = getServiceContainer().get(Mailer);
	/** Only ever used to turn a former member's subject id into an address to notify. */
	let admin = getServiceContainer().get(ManagementClient);

	let pending = await AccountDeletion.listPending(ctx.database);

	let deleted = 0;
	let errorCount = 0;

	/**
	 * Runs each row to completion before starting the next, since D1 has no interactive
	 * transactions and an overlapping cascade over the same rows would corrupt partial state.
	 * The queue is typically empty, so there is little concurrency to gain in the first place.
	 */
	for (let request of pending) {
		try {
			if (await erase(ctx, mailer, admin, request)) deleted++;
			else errorCount++;
		} catch (error) {
			errorCount++;
			ctx.logger.error("job.delete_accounts.request_failed", {
				subjectId: request.subject_id,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	ctx.logger.info("job.delete_accounts.completed", {
		total: pending.length,
		deleted,
		errorCount,
	});
});

/**
 * Erases one queued account: billing, then data, then the confirmation, then the request.
 *
 * @returns Whether the account is now fully done with — which is the same question as
 * whether the queued row was removed, and therefore whether tomorrow tries again.
 */
async function erase(
	ctx: CurrentJobContext,
	mailer: Mailer,
	admin: ManagementClient,
	request: SelectAccountDeletion,
): Promise<boolean> {
	let erased = await eraseAccount(ctx.database, polar, request.subject_id, request.email);

	if (isFailure(erased)) {
		/**
		 * Almost always a billing failure, which is the case the ordering exists for: the row
		 * stays, nothing was deleted, and the person is still billed for an account that
		 * still works.
		 */
		ctx.logger.error("job.delete_accounts.erasure_failed", {
			subjectId: request.subject_id,
			error: erased.error.message,
		});
		return false;
	}

	/**
	 * Runs before the account holder's own confirmation, since this is the only run that can
	 * still reach these people: the erasure above already deleted the rows naming them, so a
	 * later retry would find nobody to notify. Its own `try` isolates the deletion request.
	 */
	try {
		await notifyFormerMembers(ctx, mailer, admin, erased.data.deletedTeams);
	} catch (error) {
		ctx.logger.error("job.delete_accounts.notify_members_failed", {
			subjectId: request.subject_id,
			error: error instanceof Error ? error.message : String(error),
		});
	}

	let { locale, t } = await emailTranslator();

	/** Counted before the send, because a rejected send is still a billed one. */
	recordCost("emailSent");
	let sent = await mailer.send(new AccountDeletedEmail({ email: request.email, locale, t }));

	if (isFailure(sent)) {
		/**
		 * The data is gone but the confirmation is not out, so the row stays and tomorrow's
		 * run mails it. That re-run matches nothing left to delete, making a second pass over
		 * this row safe.
		 */
		ctx.logger.error("job.delete_accounts.email_failed", {
			subjectId: request.subject_id,
			error: sent.error.message,
		});
		return false;
	}

	/** Last, and only now: this row is the last thing that held the address. */
	await AccountDeletion.remove(ctx.database, request.subject_id);

	ctx.logger.info("job.delete_accounts.deleted", {
		subjectId: request.subject_id,
		teamsDeleted: erased.data.teamsDeleted,
		membershipsRemoved: erased.data.membershipsRemoved,
		subscriptionsRevoked: erased.data.subscriptionsRevoked,
	});

	return true;
}

/**
 * Mails everybody who lost a team to this erasure, one message per team they were in,
 * in each recipient's own language where they set one. An unresolvable subject is
 * skipped and a refused send only logged, since the deletion completes either way.
 *
 * @param teams - The destroyed teams that had other members, as captured before the delete.
 */
async function notifyFormerMembers(
	ctx: CurrentJobContext,
	mailer: Mailer,
	admin: ManagementClient,
	teams: DeletedTeamNotice[],
): Promise<void> {
	if (teams.length === 0) return;

	let subjectIds = teams.flatMap((team) => team.memberIds);
	let [profiles, preferences] = await Promise.all([
		resolveSubjects(admin, subjectIds),
		UserPreferences.findBySubjectIds(ctx.database, subjectIds),
	]);

	let notified = 0;
	let skipped = 0;

	for (let team of teams) {
		for (let subjectId of team.memberIds) {
			let profile = profiles.get(subjectId);

			/**
			 * The identity provider holds the only copy of a member's address, so a profile that
			 * did not resolve is a notice this run cannot send — and there is no later run that
			 * could, so it is simply recorded and the rest go out.
			 */
			if (!profile) {
				skipped++;
				ctx.logger.error("job.delete_accounts.member_profile_missing", { subjectId });
				continue;
			}

			let { locale, t } = await emailTranslator(
				preferences.get(subjectId)?.preferred_language ?? undefined,
			);

			/** Counted before the send, because a rejected send is still a billed one. */
			recordCost("emailSent");
			let sent = await mailer.send(
				new TeamDeletedEmail({ team: team.teamName, email: profile.emailAddress, locale, t }),
			);

			if (isFailure(sent)) {
				skipped++;
				ctx.logger.error("job.delete_accounts.member_email_failed", {
					subjectId,
					error: sent.error.message,
				});
				continue;
			}

			notified++;
		}
	}

	ctx.logger.info("job.delete_accounts.members_notified", {
		teams: teams.length,
		notified,
		skipped,
	});
}
