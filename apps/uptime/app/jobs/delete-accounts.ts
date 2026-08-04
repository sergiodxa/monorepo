/**
 * Background job that works through the account-deletion queue once a day: for every person
 * who asked to be erased, cancel their billing, delete their data, tell them it is done, and
 * only then forget the request itself.
 *
 * ## The queued row is the retry policy, and there is no other one
 *
 * Nothing here counts attempts, backs off, or asks the queue to redeliver. A row that fails at
 * any step is left exactly as it was, and tomorrow's run picks it up again — "it failed" and
 * "it will be retried tomorrow" are the same statement, which is the entire reason the request
 * is a row instead of a message. The row is deleted last, after the confirmation mail has been
 * accepted by the transport, so the only state that means "finished" is the absence of work.
 *
 * ## Why the order is fixed
 *
 * Billing is cancelled before any data is deleted, and a failure to cancel stops that person's
 * erasure with nothing removed. The alternative leaves somebody paying for teams that no longer
 * exist and no way to stop it: checkout and the customer portal are reached from a team's
 * billing page and require being that team's owner, so the surface that could cancel is exactly
 * what the deletion removed. See `app/services/account-erasure.ts` for the full argument.
 *
 * The mail is sent before the row goes because the row holds the address. This app stores no
 * account-holder email anywhere else, so deleting the row first would leave a completed erasure
 * that can never be confirmed to the person who asked for it.
 *
 * ## The other members are told, and that mail is never allowed to matter
 *
 * Deleting an owner deletes their teams, and with them every other member's monitoring. Those
 * people are mailed right after the erasure — the run that performed it is the only one that can,
 * because the membership rows naming them are what it just deleted, which is why the erasure hands
 * their subject ids back rather than the sweep querying for them.
 *
 * That notification is best-effort and deliberately does not gate anything. By the time it is
 * sent the data is already gone, so the usual remedy — keep the row and retry tomorrow — would
 * buy nothing and cost something: a person who asked to be deleted would keep a pending deletion
 * request (with their address in it) because somebody *else*'s mail bounced, and tomorrow's re-run
 * would re-erase an empty account and find no memberships left, so it could not resend the notice
 * anyway. A failed notice is therefore logged and the sweep carries on; whether the row survives
 * stays decided by the account holder's own confirmation mail, exactly as before. The same goes
 * for a member the identity provider cannot resolve: log them, and mail everybody who did resolve.
 *
 * ## Idempotence is load-bearing
 *
 * A failed run has already deleted part of an account, so every step must survive being run
 * again over a half-erased one: only *active* subscriptions are revoked, so a second pass
 * revokes none; teams already deleted no longer appear in the subject's memberships; and every
 * remaining delete matches nothing the second time. A re-run of a fully-erased account that
 * only failed to mail does the mail and nothing else.
 *
 * One row failing must not stop the rest, so each is caught and logged on its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { AuthSDK } from "@pkg/auth-sdk";
import { Job } from "@pkg/jobs";
import { Mailer } from "@pkg/mail";
import { PolarClient } from "@pkg/polar";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import type { DeletedTeamNotice } from "~/app/services/account-erasure";
import type { SelectAccountDeletion } from "~/database/schema";

import AccountDeletion from "~/app/data/account-deletion";
import UserPreferences from "~/app/data/user-preferences";
import { AccountDeletedEmail } from "~/app/emails/account-deleted";
import { emailTranslator } from "~/app/emails/locale";
import { TeamDeletedEmail } from "~/app/emails/team-deleted";
import { eraseAccount } from "~/app/services/account-erasure";
import { recordCost } from "~/app/services/cost";
import { resolveSubjects } from "~/app/services/subjects";

export class DeleteAccountsJob extends Job {
	async perform(): Promise<void> {
		let db = getServiceContainer().get(Database);
		let mailer = getServiceContainer().get(Mailer);
		let polar = getServiceContainer().get(PolarClient);
		/** Only ever used to turn a former member's subject id into an address to notify. */
		let sdk = getServiceContainer().get(AuthSDK);

		let pending = await AccountDeletion.listPending(db);

		let deleted = 0;
		let errorCount = 0;

		/**
		 * Sequential rather than concurrent, unlike the digest sweeps. Each row runs a long
		 * cascade of deletes against D1, which has no interactive transactions, and the queue is
		 * empty on almost every run — so there is nothing to gain from overlapping them and a
		 * partially-applied cascade racing another one is a real cost.
		 */
		for (let request of pending) {
			try {
				if (await this.erase(db, mailer, polar, sdk, request)) deleted++;
				else errorCount++;
			} catch (error) {
				errorCount++;
				this.logger.error("job.delete_accounts.request_failed", {
					subjectId: request.subject_id,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		this.logger.info("job.delete_accounts.completed", {
			total: pending.length,
			deleted,
			errorCount,
		});
	}

	/**
	 * Erases one queued account: billing, then data, then the confirmation, then the request.
	 *
	 * @returns Whether the account is now fully done with — which is the same question as
	 * whether the queued row was removed, and therefore whether tomorrow tries again.
	 */
	private async erase(
		db: Database,
		mailer: Mailer,
		polar: PolarClient,
		sdk: AuthSDK,
		request: SelectAccountDeletion,
	): Promise<boolean> {
		let erased = await eraseAccount(db, polar, request.subject_id, request.email);

		if (isFailure(erased)) {
			/**
			 * Almost always a Polar failure, which is the case the ordering exists for: the row
			 * stays, nothing was deleted, and the person is still billed for an account that
			 * still works.
			 */
			this.logger.error("job.delete_accounts.erasure_failed", {
				subjectId: request.subject_id,
				error: erased.error.message,
			});
			return false;
		}

		/**
		 * Before the account holder's own confirmation, because this is the only run that can send
		 * it: the erasure above just deleted the rows naming these people, so a run that reached
		 * the confirmation, failed it, and came back tomorrow would have nobody to notify. Its own
		 * `try` because nothing it does may change what happens to this request — see the module
		 * docblock.
		 */
		try {
			await this.notifyFormerMembers(db, mailer, sdk, erased.data.deletedTeams);
		} catch (error) {
			this.logger.error("job.delete_accounts.notify_members_failed", {
				subjectId: request.subject_id,
				error: error instanceof Error ? error.message : String(error),
			});
		}

		let { locale, t } = await emailTranslator();

		// Counted before the send, because a rejected send is still a billed one.
		recordCost("emailSent");
		let sent = await mailer.send(new AccountDeletedEmail({ email: request.email, locale, t }));

		if (isFailure(sent)) {
			/**
			 * The data is gone but the confirmation is not out, so the row stays and tomorrow's
			 * run mails it. That re-run finds nothing left to delete and is a no-op up to the
			 * send, which is exactly what makes leaving the row safe rather than destructive.
			 */
			this.logger.error("job.delete_accounts.email_failed", {
				subjectId: request.subject_id,
				error: sent.error.message,
			});
			return false;
		}

		/** Last, and only now: this row is the last thing that held the address. */
		await AccountDeletion.remove(db, request.subject_id);

		this.logger.info("job.delete_accounts.deleted", {
			subjectId: request.subject_id,
			teamsDeleted: erased.data.teamsDeleted,
			membershipsRemoved: erased.data.membershipsRemoved,
			subscriptionsRevoked: erased.data.subscriptionsRevoked,
		});

		return true;
	}

	/**
	 * Mails everybody who lost a team to this erasure, one message per team they were in.
	 *
	 * Sequential, like the queue above: a destroyed team's members are few, and the run is already
	 * inside a long cascade of D1 work. Each recipient's own language is honoured where they set
	 * one, since the reader is not the person whose account was deleted.
	 *
	 * Every failure is contained: an unresolvable subject is skipped, a refused send is logged, and
	 * neither is reported back to the caller, because the deletion must complete either way.
	 *
	 * @param teams - The destroyed teams that had other members, as captured before the delete.
	 */
	private async notifyFormerMembers(
		db: Database,
		mailer: Mailer,
		sdk: AuthSDK,
		teams: DeletedTeamNotice[],
	): Promise<void> {
		if (teams.length === 0) return;

		let subjectIds = teams.flatMap((team) => team.memberIds);
		let [profiles, preferences] = await Promise.all([
			resolveSubjects(sdk, subjectIds),
			UserPreferences.findBySubjectIds(db, subjectIds),
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
					this.logger.error("job.delete_accounts.member_profile_missing", { subjectId });
					continue;
				}

				let { locale, t } = await emailTranslator(
					preferences.get(subjectId)?.preferred_language ?? undefined,
				);

				// Counted before the send, because a rejected send is still a billed one.
				recordCost("emailSent");
				let sent = await mailer.send(
					new TeamDeletedEmail({ team: team.teamName, email: profile.emailAddress, locale, t }),
				);

				if (isFailure(sent)) {
					skipped++;
					this.logger.error("job.delete_accounts.member_email_failed", {
						subjectId,
						error: sent.error.message,
					});
					continue;
				}

				notified++;
			}
		}

		this.logger.info("job.delete_accounts.members_notified", {
			teams: teams.length,
			notified,
			skipped,
		});
	}
}
