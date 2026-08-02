/**
 * Background job that sends the free trial's daily digest: for every lead owed one, a single
 * email covering every URL they are watching.
 *
 * The unit is the person, not the target, and that is the whole reason this job exists apart
 * from the hourly sweep. Someone who tried three URLs is one reader with one inbox, so they
 * get one email a day with three sections in it rather than three emails — which is why the
 * schedule lives on `leads.last_digest_at` and why `Lead.listDueForDigest` is driven off an
 * `EXISTS` against their watches instead of a join that would return them once per URL.
 *
 * Idempotence is the stamp. `Lead.listDueForDigest` selects only leads whose last digest
 * predates today's UTC midnight, and `Lead.markDigestSent` moves that date, so a redelivered
 * message finds nothing to do. The stamp is written only after a send the transport accepted:
 * a digest that failed to render or to deliver leaves the lead due, and the next delivery of
 * the same day's trigger retries it.
 *
 * A lead with no active watches gets nothing, and the query already says so — but a watch can
 * finish between the query and the read, so the "nothing to report" branch is real and exits
 * without stamping rather than sending an empty email.
 *
 * Nothing here is billed. A lead is not a Polar customer and never becomes one by being
 * written to; the only cost recorded is the send itself and this delivery's own share of the
 * platform, which the ledger attributes to nobody — see the note in `perform`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Job } from "@pkg/jobs";
import { Mailer } from "@pkg/mail";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import type { TrialWatchDigestEntry } from "~/app/data/trial-watch";
import type { TrialStats } from "~/app/emails/shared/trial";
import type { SelectLead, SelectTrialWatchResult } from "~/database/schema";

import Lead from "~/app/data/lead";
import TrialWatch, { isHealthyTrialStatus } from "~/app/data/trial-watch";
import { emailTranslator } from "~/app/emails/locale";
import { TrialDailyDigestEmail } from "~/app/emails/trial-daily-digest";
import { mapWithConcurrency } from "~/app/lib/concurrency";
import { formatUptime, segmentsOver } from "~/app/lib/trial-report";
import { recordCost } from "~/app/services/cost";

const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * How many hours one digest reports, one segment of its bar per hour.
 *
 * A rolling twenty-four hours ending now, rather than the UTC calendar day the once-a-day
 * bound is counted in. The two would disagree by however long after midnight the trigger
 * runs, and a calendar-day window would leave those hours unreported until the following
 * day's email; a rolling window run once a day tiles the time with no gap and no overlap. It
 * is also what the bar's own captions promise, since they read "24 hours ago" and "Now".
 */
const DIGEST_WINDOW_HOURS = 24;

export class SendTrialDigestsJob extends Job {
	async perform(): Promise<void> {
		let db = getServiceContainer().get(Database);
		let mailer = getServiceContainer().get(Mailer);
		/**
		 * One instant for the whole run, so the window every digest reports and the stamp every
		 * lead receives agree with the query that selected them.
		 */
		let now = Date.now();

		let leads = await Lead.listDueForDigest(db, now);

		/**
		 * Deliberately no `apportionCost` call. A lead belongs to no team, so with no weights
		 * recorded the ledger puts this delivery on `PLATFORM_TEAM_ID` with a `platform`
		 * attribution — the truth — where naming that id as a weight would record the spend as
		 * a `direct` attribution to a team that does not exist.
		 */

		let settled = await mapWithConcurrency(leads, (lead) => this.digest(db, mailer, lead, now));

		let sent = 0;
		let skipped = 0;
		let errorCount = 0;

		for (let outcome of settled) {
			if (!outcome.ok) {
				errorCount++;
				this.logger.error("job.send_trial_digests.lead_failed", {
					leadId: outcome.item.id,
					error: outcome.error instanceof Error ? outcome.error.message : String(outcome.error),
				});
				continue;
			}

			if (outcome.value) sent++;
			else skipped++;
		}

		this.logger.info("job.send_trial_digests.completed", {
			total: leads.length,
			sent,
			skipped,
			errorCount,
		});
	}

	/**
	 * Sends one lead their whole day: every target they are still watching, in the language
	 * they were browsing in when they handed the address over.
	 *
	 * @returns Whether a digest went out, which is what the stamp and the counters key on.
	 */
	private async digest(
		db: Database,
		mailer: Mailer,
		lead: SelectLead,
		now: number,
	): Promise<boolean> {
		let since = now - DIGEST_WINDOW_HOURS * MS_PER_HOUR;
		let entries = await TrialWatch.listDigestForLead(db, lead.id, since);

		let targets = entries
			.map((entry) => toTarget(entry, since))
			.filter((target) => target !== null);

		if (targets.length === 0) {
			this.logger.info("job.send_trial_digests.nothing_to_report", { leadId: lead.id });
			return false;
		}

		let { locale, t } = await emailTranslator(lead.locale);

		// Counted before the send, because a rejected send is still a billed one.
		recordCost("emailSent");
		let result = await mailer.send(
			new TrialDailyDigestEmail({
				to: lead.email,
				targets,
				unsubscribeToken: lead.unsubscribe_token,
				locale,
				t,
			}),
		);

		if (isFailure(result)) {
			this.logger.error("job.send_trial_digests.email_failed", {
				leadId: lead.id,
				error: result.error.message,
			});
			return false;
		}

		/** Only now: the stamp is what moves this lead's next digest to tomorrow. */
		await Lead.markDigestSent(db, lead.id, now);
		return true;
	}
}

/**
 * One watched target as its section of the digest, or `null` when there is nothing to say
 * about it.
 *
 * A target with no checks in the window still has a section — an all-empty bar reading zero
 * checks is itself the report, and dropping it would silently shrink an email that names how
 * many URLs it covers. What is dropped is a target whose status is unknown *and* unrecorded,
 * which is a watch that has never completed a check: the digest reports a state per URL and
 * there is no honest one to print.
 */
function toTarget(
	entry: TrialWatchDigestEntry,
	since: number,
): TrialDailyDigestEmail.Target | null {
	/** The last check of the window, falling back to the watch's own cached last status. */
	let status = entry.results.at(-1)?.status ?? entry.watch.last_status;
	if (status === null) return null;

	return {
		url: entry.watch.url,
		status,
		segments: segmentsOver(entry.results, since, MS_PER_HOUR, DIGEST_WINDOW_HOURS),
		stats: windowStats(entry.results),
	};
}

/**
 * The three numbers under a daily bar, derived from the window's rows rather than from the
 * watch's running totals: those totals cover the target's whole life, and a seven-day figure
 * printed under a one-day bar would describe something the reader is not looking at.
 *
 * A slowest response of zero means nothing answered, since a response that was measured has a
 * duration and one that was not is stored as `NULL`.
 */
function windowStats(results: SelectTrialWatchResult[]): TrialStats {
	let healthy = results.filter((result) => isHealthyTrialStatus(result.status)).length;
	let slowest = results.reduce((max, result) => Math.max(max, result.response_time_ms ?? 0), 0);

	return {
		checks: results.length,
		uptime: results.length === 0 ? null : formatUptime(healthy / results.length),
		slowestResponseMs: slowest === 0 ? null : slowest,
	};
}
