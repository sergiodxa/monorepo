/**
 * Background job that re-checks the URLs anonymous visitors left on the public try-it page:
 * one HTTP probe an hour for seven days, then a wrap-up and nothing further. It claims the
 * watches whose hour has come round, probes each one, records the result, and sends the two
 * emails a single target can earn — the on-change notice and the seven-day summary.
 *
 * Shaped like the DNS and TCP sweeps, and for the same reasons: `TrialWatch.claimDue` is the
 * same atomic claim the three monitor tables use, so the several deliveries one trigger
 * produces cannot check a watch twice; the probes run in bounded-concurrency batches, so the
 * sweep's wall time is not the sum of every target's timeout; and a watch whose probe threw
 * is counted and skipped rather than failing the run.
 *
 * The probe itself is `HttpCheck`, the same class the paid monitors and the ad-hoc ping API
 * use, which is the point: a trial result and a paid result have to mean the same thing, or
 * the demo is a demo of something we do not sell. How it is configured is not decided here —
 * `trialProbeOptions` is shared with the visitor's first probe on `/try`, because the result
 * a stranger sees on the page and the results these digests report a week later are presented
 * as one measurement and stop being one if the two callers drift.
 *
 * ## The probe must not follow redirects
 *
 * `trialProbeOptions` sets `followRedirects: false` and nothing here may override it.
 * `app/services/trial-guard.ts` decides whether a target is safe by resolving its hostname and
 * checking the addresses it answers with; a public URL replying `302 http://169.254.169.254/`
 * reaches cloud metadata anyway if the hop is taken, long after the guard has finished
 * deciding. Refusing to follow is what makes the guard's decision the one that holds, and it
 * is the residual risk that guard's own docblock names. Do not "fix" this back to `follow`.
 *
 * The cost is that a redirect is recorded as the 3xx it is, which classifies `down` against
 * the expected 200 — so a site that redirects reads as down for the whole week. That is
 * deliberate and it is the same answer a paid monitor on the same URL would give, which is the
 * only answer that does not set a converting visitor up to watch their new monitor go red on
 * day one. The place to catch it is the try-it page, where the visitor can still fix the URL
 * they typed, not a digest seven days later.
 *
 * ## Nothing here is billed, and nothing here is a ping
 *
 * A trial check is free. `ingestPings` is never called and no Polar event is written, because
 * there is no customer to meter against — a lead is not a Polar customer and is only ever
 * provisioned as one by actually signing up.
 *
 * No Analytics Engine point is written either, which is the less obvious half. The argument
 * for writing one is that `uptime_monitor_results` is where check outcomes live and a trial
 * probe is a real check. The argument against wins on every practical count: every query
 * against that dataset filters `index1` to a team id and `blob1` to a monitor id, and a watch
 * has neither — writing `platform` there would put rows in a per-customer dataset that no
 * per-customer query can ever select, and writing a real team id would attribute a stranger's
 * URL to a paying customer. Nothing would read the rows back, since the digests draw their
 * bars from `trial_watch_results` and their totals from the watch row. And it is not free:
 * one point per check is 168 points per watch, on a feature whose whole cost model is a fence
 * around free work. What the trial *does* cost is already visible, because the cost ledger
 * records this delivery under `PLATFORM_TEAM_ID` — see the attribution note in `perform`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Job } from "@pkg/jobs";
import { Mailer } from "@pkg/mail";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import type { ClaimedTrialWatch } from "~/app/data/trial-watch";
import type { HttpCheckResult } from "~/app/services/http-check";
import type { MonitorStatus, SelectLead } from "~/database/schema";

import Lead from "~/app/data/lead";
import TrialWatch, {
	TRIAL_WATCH_DURATION_DAYS,
	shouldNotifyChange,
	shouldSendSummary,
} from "~/app/data/trial-watch";
import { emailTranslator } from "~/app/emails/locale";
import { TrialChangeEmail } from "~/app/emails/trial-change";
import { TrialWeeklyDigestEmail } from "~/app/emails/trial-weekly-digest";
import { mapWithConcurrency } from "~/app/lib/concurrency";
import { trialProbeOptions } from "~/app/lib/trial-probe";
import { segmentsOver, watchStats } from "~/app/lib/trial-report";
import { recordCost } from "~/app/services/cost";
import { HttpCheck } from "~/app/services/http-check";
import routes from "~/routes/web";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Origin the wrap-up's call to action points at; the host this app is served from. */
const APP_ORIGIN = "https://uptime.sergiodxa.com";

/** What one watch's turn in the sweep did, for the counters the completion line carries. */
interface CheckedWatch {
	/** Whether the target was probed and a result recorded. */
	probed: boolean;
	/** Whether an on-change email went out. */
	changed: boolean;
	/** Whether the seven-day wrap-up went out and the watch ended. */
	wrappedUp: boolean;
}

/** A watch that did none of the three, for the branches that end one without checking it. */
const DID_NOTHING: CheckedWatch = { probed: false, changed: false, wrappedUp: false };

export class CheckTrialWatchesJob extends Job {
	async perform(): Promise<void> {
		let db = getServiceContainer().get(Database);
		let mailer = getServiceContainer().get(Mailer);
		/**
		 * One instant for the whole sweep, and the same one the claim ran against, so that
		 * "has this watch expired", "was the last change email sent today" and the timestamps
		 * written to the two emails all agree with each other. A per-branch `Date.now()` could
		 * straddle a UTC midnight inside one delivery and send two change emails for one day.
		 */
		let now = Date.now();

		let watches = await TrialWatch.claimDue(db, now);

		/**
		 * Deliberately no `apportionCost` call. These probes belong to no team: a lead is not
		 * a customer and never becomes one by being watched. With no weights recorded the
		 * ledger's own default puts the whole delivery on `PLATFORM_TEAM_ID` with a `platform`
		 * attribution, which is the truth — whereas naming `PLATFORM_TEAM_ID` as a weight
		 * would record the same spend as a `direct` attribution to a team that does not exist,
		 * and the reporting job cannot tell those two apart afterwards.
		 */

		let settled = await mapWithConcurrency(watches, (watch) => this.check(db, mailer, watch, now));

		let probed = 0;
		let changed = 0;
		let wrappedUp = 0;
		let errorCount = 0;

		for (let outcome of settled) {
			if (!outcome.ok) {
				errorCount++;
				this.logger.error("job.check_trial_watches.watch_failed", {
					watchId: outcome.item.id,
					error: outcome.error instanceof Error ? outcome.error.message : String(outcome.error),
				});
				continue;
			}

			if (outcome.value.probed) probed++;
			if (outcome.value.changed) changed++;
			if (outcome.value.wrappedUp) wrappedUp++;
		}

		this.logger.info("job.check_trial_watches.completed", {
			total: watches.length,
			probed,
			changed,
			wrappedUp,
			errorCount,
		});
	}

	/**
	 * Runs one claimed watch's turn: the wrap-up branch for a watch whose week is over, and
	 * otherwise a probe, a recorded result, and the on-change email that result may warrant.
	 *
	 * An expired watch is not probed. The claim hands those over deliberately — it is the only
	 * way the wrap-up ever gets sent — but the seven days it reports on are already complete,
	 * and a 169th check would both widen the window the summary covers and write a result row
	 * to a watch that has stopped.
	 *
	 * Throwing here is what marks a watch as failed and leaves the rest of the sweep alone.
	 */
	private async check(
		db: Database,
		mailer: Mailer,
		watch: ClaimedTrialWatch,
		now: number,
	): Promise<CheckedWatch> {
		if (now >= watch.expires_at) return await this.expire(db, mailer, watch, now);

		let result = await new HttpCheck(trialProbeOptions(watch.url)).run();

		let previousStatus = watch.last_status;
		/** Read from the claimed row before `recordCheck` overwrites the column it compares. */
		let notify = shouldNotifyChange(watch, result.status, now);

		await TrialWatch.recordCheck(db, watch, {
			status: result.status,
			responseTimeMs: result.outcome.responseTimeMs,
		});

		/**
		 * `shouldNotifyChange` already refused a watch with no previous status; naming that
		 * condition again is what gives the email a status it can report rather than a null.
		 */
		if (!notify || previousStatus === null)
			return { probed: true, changed: false, wrappedUp: false };

		let sent = await this.sendChange(db, mailer, watch, previousStatus, result, now);
		/**
		 * Stamped only on a send that happened. The stamp is what closes the day's bound, so
		 * stamping a failed send would spend the day's one change email on nothing and leave
		 * the reader unaware their site went down.
		 */
		if (sent) {
			await TrialWatch.markChangeNotified(db, watch.id, now);
			/** Same condition, one row up: the funnel counts what landed, not what was tried. */
			await Lead.recordEmailSent(db, watch.lead_id, now);
		}

		return { probed: true, changed: sent, wrappedUp: false };
	}

	/**
	 * Ends a watch whose seven days are up, sending the wrap-up when one is still owed.
	 *
	 * The three exits are different on purpose. A watch that has already been wrapped up is
	 * finished outright, since nothing else will ever be done with it and leaving it due would
	 * have it claimed every hour until the thirty-day delete. A watch whose lead is gone is
	 * finished too: there is nobody to write to, so retrying is retrying nothing. A wrap-up
	 * that failed to send is the one case left alone — the row keeps the due time the claim
	 * advanced, so the next hourly delivery tries again, and the watch's own deletion at
	 * `converts_until` is the backstop on how long that can go on.
	 */
	private async expire(
		db: Database,
		mailer: Mailer,
		watch: ClaimedTrialWatch,
		now: number,
	): Promise<CheckedWatch> {
		if (!shouldSendSummary(watch, now)) {
			await TrialWatch.finish(db, watch.id);
			return DID_NOTHING;
		}

		let lead = await Lead.findById(db, watch.lead_id);
		if (!lead) {
			this.logger.error("job.check_trial_watches.lead_missing", {
				watchId: watch.id,
				leadId: watch.lead_id,
			});
			await TrialWatch.finish(db, watch.id);
			return DID_NOTHING;
		}

		if (!(await this.sendSummary(db, mailer, watch, lead))) return DID_NOTHING;

		/** One write that both records the send and ends the watch; the two are one event. */
		await TrialWatch.markSummarySent(db, watch.id, now);
		/** Same condition: the funnel counts what landed, not what was tried. */
		await Lead.recordEmailSent(db, lead.id, now);
		return { probed: false, changed: false, wrappedUp: true };
	}

	/**
	 * Tells one lead that a target they are watching is doing something different, in the
	 * language they were browsing in.
	 *
	 * @returns Whether the message was accepted, which is what decides the day's bound.
	 */
	private async sendChange(
		db: Database,
		mailer: Mailer,
		watch: ClaimedTrialWatch,
		previousStatus: MonitorStatus,
		result: HttpCheckResult,
		now: number,
	): Promise<boolean> {
		let lead = await Lead.findById(db, watch.lead_id);
		if (!lead) {
			this.logger.error("job.check_trial_watches.lead_missing", {
				watchId: watch.id,
				leadId: watch.lead_id,
			});
			return false;
		}

		let { locale, t } = await emailTranslator(lead.locale);

		// Counted before the send, because a rejected send is still a billed one.
		recordCost("emailSent");
		let sent = await mailer.send(
			new TrialChangeEmail({
				to: lead.email,
				url: watch.url,
				status: result.status,
				previousStatus,
				responseStatus: result.outcome.responseStatus,
				responseTimeMs: result.outcome.responseTimeMs,
				changedAt: new Date(now),
				unsubscribeToken: lead.unsubscribe_token,
				locale,
				t,
			}),
		);

		if (isFailure(sent)) {
			this.logger.error("job.check_trial_watches.change_email_failed", {
				watchId: watch.id,
				error: sent.error.message,
			});
			return false;
		}

		return true;
	}

	/**
	 * Sends one target's seven-day wrap-up: the week as a bar, its three numbers, and the one
	 * call to action this family of emails is allowed.
	 *
	 * The numbers come from the watch row's running totals rather than from the history rows,
	 * which is what those columns are for — they already cover exactly the window being
	 * reported, and re-deriving them would read 168 rows to reach the same answer. The bar
	 * still needs the rows, because seven daily segments cannot be recovered from a total.
	 *
	 * @returns Whether the message was accepted, which is what decides whether the watch ends.
	 */
	private async sendSummary(
		db: Database,
		mailer: Mailer,
		watch: ClaimedTrialWatch,
		lead: SelectLead,
	): Promise<boolean> {
		let row = await TrialWatch.findById(db, watch.id);
		if (!row) {
			this.logger.error("job.check_trial_watches.watch_missing", { watchId: watch.id });
			return false;
		}

		let results = await TrialWatch.listResultsBetween(db, row.id, row.created_at, row.expires_at);
		let { locale, t } = await emailTranslator(lead.locale);

		/**
		 * Built here rather than at module scope, where a Worker does no work. Signing in is
		 * what turns a watched target into a real monitor — `TrialWatch.listConvertibleByLead`
		 * is read by the sign-in path — so the link is the app entry point, which sends a
		 * signed-out reader through sign-in and back with their targets already converted.
		 */
		let subscribeUrl = `${APP_ORIGIN}${routes.app.index.href()}`;

		recordCost("emailSent");
		let sent = await mailer.send(
			new TrialWeeklyDigestEmail({
				to: lead.email,
				url: row.url,
				segments: segmentsOver(results, row.created_at, MS_PER_DAY, TRIAL_WATCH_DURATION_DAYS),
				stats: watchStats(row),
				subscribeUrl,
				unsubscribeToken: lead.unsubscribe_token,
				locale,
				t,
			}),
		);

		if (isFailure(sent)) {
			this.logger.error("job.check_trial_watches.summary_email_failed", {
				watchId: watch.id,
				error: sent.error.message,
			});
			return false;
		}

		return true;
	}
}
