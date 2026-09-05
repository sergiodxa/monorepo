/**
 * Background job that re-checks the URLs anonymous visitors left on the public try-it
 * page: one HTTP probe an hour for seven days, then a wrap-up. Shaped after the paid
 * monitor sweeps — the same atomic claim, bounded-concurrency probing, and `HttpCheck`
 * class — so a trial result means what a paid result means. Trial checks are free and
 * unbilled; the sweep's own cost lands on `PLATFORM_TEAM_ID`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CurrentJobContext } from "@sdxc/jobs";

import { createJobHandler } from "@sdxc/jobs";
import { Mailer } from "@sdxc/mail";
import { isFailure } from "@sdxc/result";
import { getServiceContainer } from "@sdxc/service-container";

import type { ClaimedTrialWatch } from "~/app/data/trial-watch";
import type { HttpCheckResult } from "~/app/services/http-check";
import type { MonitorStatus, SelectLead } from "~/database/schema";

import Lead from "~/app/data/lead";
import TrialWatch, {
	TRIAL_WATCH_DURATION_DAYS,
	isHealthyTrialStatus,
	shouldNotifyChange,
	shouldSendSummary,
} from "~/app/data/trial-watch";
import { emailTranslator } from "~/app/emails/locale";
import { TrialChangeEmail } from "~/app/emails/trial-change";
import { TrialWeeklyDigestEmail } from "~/app/emails/trial-weekly-digest";
import jobs from "~/app/jobs";
import { mapWithConcurrency } from "~/app/lib/concurrency";
import { trialProbeOptions } from "~/app/lib/trial-probe";
import { segmentsOver, watchStats } from "~/app/lib/trial-report";
import { recordCost } from "~/app/services/cost";
import {
	hostnameOf,
	trackFirstTrialAlertSent,
	trackFirstTrialCheckCompleted,
} from "~/app/services/funnel-events";
import { HttpCheck } from "~/app/services/http-check";
import routes from "~/routes/web";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * How long after creation a watch's first unattended check is still looked for. A day is
 * generous for a delayed sweep, and keeps the extra indexed read that confirms
 * `checks_run === 1` off the other 167 checks a watch gets over the week.
 */
const FIRST_CHECK_WINDOW_MS = MS_PER_DAY;

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

export default createJobHandler(jobs.checkTrialWatches, async (ctx) => {
	let mailer = getServiceContainer().get(Mailer);
	/**
	 * One instant for the whole sweep, matching the claim's own, so "has this watch expired"
	 * and "was today's change email already sent" agree with the timestamps written to both
	 * emails — a per-branch `Date.now()` could straddle midnight and double-send in one day.
	 */
	let now = Date.now();

	let watches = await TrialWatch.claimDue(ctx.database, now);

	/**
	 * No `apportionCost` call: a lead is never a billing team, so leaving its weights empty
	 * lets the ledger default this delivery to `PLATFORM_TEAM_ID` under a `platform`
	 * attribution, keeping it distinguishable from a team's own direct spend.
	 */

	let settled = await mapWithConcurrency(watches, (watch) => check(ctx, mailer, watch, now));

	let probed = 0;
	let changed = 0;
	let wrappedUp = 0;
	let errorCount = 0;

	for (let outcome of settled) {
		if (!outcome.ok) {
			errorCount++;
			ctx.log.warn("trial.watch_failed", {
				"watch.id": outcome.item.id,
				error: outcome.error instanceof Error ? outcome.error.message : String(outcome.error),
			});
			continue;
		}

		if (outcome.value.probed) probed++;
		if (outcome.value.changed) changed++;
		if (outcome.value.wrappedUp) wrappedUp++;
	}

	ctx.log.set({
		trial: { watches: watches.length, probed, changed, wrapped_up: wrappedUp, failed: errorCount },
	});
});

/**
 * Runs one claimed watch's turn: a wrap-up when its week is over, otherwise a probe,
 * a recorded result, and any on-change email it warrants. Throwing here fails only
 * this watch; an expired one skips the probe since a 169th check would widen the week.
 */
async function check(
	ctx: CurrentJobContext,
	mailer: Mailer,
	watch: ClaimedTrialWatch,
	now: number,
): Promise<CheckedWatch> {
	if (now >= watch.expires_at) return await expire(ctx, mailer, watch, now);

	/**
	 * `trialProbeOptions` disables redirect-following; `app/services/trial-guard.ts` clears
	 * the URL by resolving its hostname, and following a redirect afterwards could still
	 * land on an address the guard never saw. Keep it disabled here.
	 */
	let result = await new HttpCheck(trialProbeOptions(watch.url)).run();

	let previousStatus = watch.last_status;
	/** Read from the claimed row before `recordCheck` overwrites the column it compares. */
	let notify = shouldNotifyChange(watch, result.status, now);
	/**
	 * Read before the send stamps it, for the same reason: `null` here is what makes the
	 * email below this watch's *first* alert, with any later flap repeating that step.
	 */
	let firstAlert = watch.change_notified_at === null;

	await TrialWatch.recordCheck(ctx.database, watch, {
		status: result.status,
		responseTimeMs: result.outcome.responseTimeMs,
	});

	await reportFirstCheck(ctx, watch, result.status, now);

	/**
	 * `shouldNotifyChange` already refused a watch with no previous status; naming that
	 * condition again is what gives the email a status of its own to report here.
	 */
	if (!notify || previousStatus === null) return { probed: true, changed: false, wrappedUp: false };

	let sent = await sendChange(ctx, mailer, watch, previousStatus, result, now);
	/**
	 * Stamped only on a send that happened. The stamp is what closes the day's bound, so
	 * stamping a failed send would spend the day's one change email on nothing and leave
	 * the reader unaware their site went down.
	 */
	if (sent) {
		await TrialWatch.markChangeNotified(ctx.database, watch.id, now);
		/** Same condition, one row up: the funnel counts confirmed sends. */
		await Lead.recordEmailSent(ctx.database, watch.lead_id, now);

		if (firstAlert) {
			trackFirstTrialAlertSent(ctx.log, {
				leadId: watch.lead_id,
				watchId: watch.id,
				hostname: hostnameOf(watch.url),
				monitorType: "http",
				status: result.status,
				previousStatus,
			});
		}
	}

	return { probed: true, changed: sent, wrappedUp: false };
}

/**
 * Emits the funnel's first-unattended-check event when `checks_run` reads exactly `1`
 * after `recordCheck` incremented it — the one fact about "first check" that cannot drift.
 * Its own try/catch keeps a failed read from costing the sweep an already-checked watch.
 */
async function reportFirstCheck(
	ctx: CurrentJobContext,
	watch: ClaimedTrialWatch,
	status: MonitorStatus,
	now: number,
): Promise<void> {
	if (now - watch.created_at > FIRST_CHECK_WINDOW_MS) return;

	try {
		let row = await TrialWatch.findById(ctx.database, watch.id);
		if (row?.checks_run !== 1) return;

		trackFirstTrialCheckCompleted(ctx.log, {
			leadId: watch.lead_id,
			watchId: watch.id,
			hostname: hostnameOf(watch.url),
			monitorType: "http",
			status,
			succeeded: isHealthyTrialStatus(status),
		});
	} catch (error) {
		ctx.log.warn("trial.first_check_report_failed", {
			"watch.id": watch.id,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

/**
 * Ends a watch whose seven days are up, sending the wrap-up when one is still owed.
 * An already-wrapped-up or lead-gone watch finishes immediately, closing off the
 * hourly reclaim; a failed send stays due, bounded by deletion at `converts_until`.
 */
async function expire(
	ctx: CurrentJobContext,
	mailer: Mailer,
	watch: ClaimedTrialWatch,
	now: number,
): Promise<CheckedWatch> {
	if (!shouldSendSummary(watch, now)) {
		await TrialWatch.finish(ctx.database, watch.id);
		return DID_NOTHING;
	}

	let lead = await Lead.findById(ctx.database, watch.lead_id);
	if (!lead) {
		ctx.log.warn("trial.lead_missing", { "watch.id": watch.id, "lead.id": watch.lead_id });
		await TrialWatch.finish(ctx.database, watch.id);
		return DID_NOTHING;
	}

	if (!(await sendSummary(ctx, mailer, watch, lead))) return DID_NOTHING;

	/** One write that both records the send and ends the watch; the two are one event. */
	await TrialWatch.markSummarySent(ctx.database, watch.id, now);
	/** Same condition: the funnel counts confirmed sends. */
	await Lead.recordEmailSent(ctx.database, lead.id, now);
	return { probed: false, changed: false, wrappedUp: true };
}

/**
 * Tells one lead that a target they are watching is doing something different, in the
 * language they were browsing in. A rejected send is still billed, so cost is recorded
 * before the send resolves.
 *
 * @returns Whether the message was accepted, which is what decides the day's bound.
 */
async function sendChange(
	ctx: CurrentJobContext,
	mailer: Mailer,
	watch: ClaimedTrialWatch,
	previousStatus: MonitorStatus,
	result: HttpCheckResult,
	now: number,
): Promise<boolean> {
	let lead = await Lead.findById(ctx.database, watch.lead_id);
	if (!lead) {
		ctx.log.warn("trial.lead_missing", { "watch.id": watch.id, "lead.id": watch.lead_id });
		return false;
	}

	let { locale, t } = await emailTranslator(lead.locale);

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
		ctx.log.warn("trial.change_email_failed", {
			"watch.id": watch.id,
			error: sent.error.message,
		});
		return false;
	}

	return true;
}

/**
 * Sends one target's seven-day wrap-up: the week as a bar plus its three summary
 * numbers, read from the watch row's own running totals — cheaper than re-deriving
 * them from 168 history rows, which the bar still needs for its daily segments.
 *
 * @returns Whether the message was accepted, which is what decides whether the watch ends.
 */
async function sendSummary(
	ctx: CurrentJobContext,
	mailer: Mailer,
	watch: ClaimedTrialWatch,
	lead: SelectLead,
): Promise<boolean> {
	let row = await TrialWatch.findById(ctx.database, watch.id);
	if (!row) {
		ctx.log.warn("trial.watch_missing", { "watch.id": watch.id });
		return false;
	}

	let results = await TrialWatch.listResultsBetween(
		ctx.database,
		row.id,
		row.created_at,
		row.expires_at,
	);
	let { locale, t } = await emailTranslator(lead.locale);

	/**
	 * Built inside the request: signing in is what turns a watched target into a real
	 * monitor, and `TrialWatch.listConvertibleByLead` runs on the sign-in path, so the
	 * link is the app entry point, carrying a signed-out reader through sign-in first.
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
			/**
			 * The same report as a page, so a reader who comes back to it in a month — or
			 * forwards it to the client whose site it describes — can revisit it straight
			 * from the link. `row` is the whole watch, so the token is already in hand.
			 */
			reportToken: row.report_token,
			unsubscribeToken: lead.unsubscribe_token,
			locale,
			t,
		}),
	);

	if (isFailure(sent)) {
		ctx.log.warn("trial.summary_email_failed", {
			"watch.id": watch.id,
			error: sent.error.message,
		});
		return false;
	}

	return true;
}
