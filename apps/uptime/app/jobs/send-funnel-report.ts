/**
 * Daily background job that counts yesterday's public-trial funnel, stores the count, and
 * mails it to whoever operates the deployment.
 *
 * The question it exists to answer is the one none of the trial tables can: somebody used
 * the free form, gave us an address, received some number of emails, and some number of days
 * later became a paying customer. Each third of that sentence lives in a different place —
 * `leads` and `trial_watches` at the front, `trial_conversions` in the middle, Polar at the
 * end — and two of the three are deleted within a month, so the counting has to happen while
 * the rows are still there.
 *
 * **Two outputs, and only one of them is the email.** Every run writes a `trial_daily_stats`
 * row for the day it reported, whether or not anything is sent: that row is the only version
 * of the day that survives the thirty-day sweep and the retroactive deletion an unsubscribe
 * performs, so skipping it on a quiet day or on an unconfigured deployment would leave a hole
 * nothing can fill in later. The email is suppressed in two cases and the row is written in
 * both.
 *
 * **It is silent unless a deployment asks for it.** The recipient is the `FUNNEL_REPORT_TO`
 * worker variable and there is no fallback address, so local, preview and test runs count the
 * day, write it down, and send nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { toDayKey, subDays } from "@pkg/dates";
import { Job } from "@pkg/jobs";
import { Mailer } from "@pkg/mail";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";

import type { TrialDailyCounters } from "~/app/data/trial-daily-stats";
import type { SelectTrialConversion } from "~/database/schema";

import Lead from "~/app/data/lead";
import { getYesterdayDateUtc, utcDayBounds } from "~/app/data/monitor-daily-stats";
import TrialConversion, { trialConversionUrls } from "~/app/data/trial-conversion";
import TrialDailyStats, { isEmptyDay } from "~/app/data/trial-daily-stats";
import TrialWatch from "~/app/data/trial-watch";
import { FunnelReportEmail } from "~/app/emails/funnel-report";
import { recordCost } from "~/app/services/cost";

/**
 * How many days of context the report closes with, the reported day included.
 *
 * Thirty because that is how long a trial attempt stays claimable, so it is the shortest
 * window in which a lead from the start of it could still have converted at the end. It is
 * summed out of `trial_daily_stats` rather than re-queried, which is the entire reason that
 * table exists.
 */
const FUNNEL_TOTALS_DAYS = 30;

/**
 * The internal address the report goes to, when the running deployment names one.
 *
 * Read structurally off `env` rather than through the generated `Cloudflare.Env`, which is
 * what makes an unset variable a supported state rather than a type error or a crash: the
 * variable is deployment configuration, and every environment that does not set it — local
 * dev, preview, the test suite — must run this job to completion and simply not send. An
 * empty string counts as absent, since that is what a variable declared and left blank looks
 * like.
 *
 * @returns The recipient, or `null` when this deployment has none.
 */
function funnelReportRecipient(): string | null {
	let candidate: unknown = (env as { FUNNEL_REPORT_TO?: unknown }).FUNNEL_REPORT_TO;
	if (typeof candidate !== "string" || candidate.length === 0) return null;
	return candidate;
}

export class SendFunnelReportJob extends Job {
	/** The "Trial Funnel Report" cron monitor this job reports itself to when it completes. */
	static override monitorId = "b6f2e0a4-9c31-4d58-a0e7-5f8c1b2d47a9";

	async perform(): Promise<void> {
		let db = getServiceContainer().get(Database);
		let mailer = getServiceContainer().get(Mailer);
		let date = getYesterdayDateUtc();
		let { start, end } = utcDayBounds(date);

		/**
		 * Deliberately no `apportionCost` call, for the same reason the digest job makes none: a
		 * lead belongs to no team, so with no weights recorded the ledger attributes this run to
		 * the platform, which is the truth.
		 */

		let leads = await Lead.countFunnelActivity(db, start, end);
		let watches = await TrialWatch.countFunnelActivity(db, start, end);
		let paid = await TrialConversion.listPaidBetween(db, start, end);
		let signups = await TrialConversion.listSignedUpBetween(db, start, end);

		let counters: TrialDailyCounters = {
			newLeads: leads.created,
			urlsChecked: watches.created,
			/**
			 * The one counter with no column of its own, because nothing records a send as an
			 * event: the per-lead total is a running one and it dies with the lead. It is derived
			 * from the four stamps the four sends leave — one confirmation per watch created, one
			 * digest per lead stamped, one change email and one wrap-up per watch stamped — which
			 * is exact for three of them, since each of those is written at most once a day and
			 * only after a transport accepted the message. The confirmation is the approximate
			 * one: counted as a watch created, so a submission whose confirmation was rejected
			 * still counts. Sharpening it means a row per send kept forever, to correct a number
			 * that is read once a day.
			 */
			emailsSent:
				watches.created + watches.changeEmails + watches.summaryEmails + leads.digestsSent,
			freeSignups: signups.length,
			paidConversions: paid.length,
		};

		/** Written first and unconditionally: the row outlives every table it was counted from. */
		await TrialDailyStats.upsertDay(db, { date, ...counters });

		let to = funnelReportRecipient();
		if (to === null) {
			this.logger.info("job.send_funnel_report.no_recipient", { date });
			return;
		}

		if (isEmptyDay(counters)) {
			this.logger.info("job.send_funnel_report.nothing_to_report", { date });
			return;
		}

		let totals = await TrialDailyStats.totalsBetween(db, startOfTotals(date), date);

		// Counted before the send, because a rejected send is still a billed one.
		recordCost("emailSent");
		let sent = await mailer.send(
			new FunnelReportEmail({
				to,
				date,
				counters,
				totals,
				totalDays: FUNNEL_TOTALS_DAYS,
				paid: paid.map(toConversion),
				/**
				 * Only the ones still free, so an account that signed up and paid on the same day is
				 * itemised once, under the outcome that matters.
				 */
				signups: signups.filter((row) => row.paid_at === null).map(toConversion),
			}),
		);

		if (isFailure(sent)) {
			this.logger.error("job.send_funnel_report.email_failed", { date, error: sent.error.message });
			return;
		}

		this.logger.info("job.send_funnel_report.completed", { date, ...counters });
	}
}

/** The first day of the trailing window, as the `YYYY-MM-DD` key the totals range over. */
function startOfTotals(date: string): string {
	return toDayKey(subDays(new Date(`${date}T00:00:00.000Z`), FUNNEL_TOTALS_DAYS - 1), "UTC");
}

/** A stored conversion as the email itemises it, with its instants read out of the integers. */
function toConversion(row: SelectTrialConversion): FunnelReportEmail.Conversion {
	return {
		urls: trialConversionUrls(row),
		watchCount: row.watch_count,
		emailsSent: row.emails_sent,
		leadCreatedAt: new Date(row.lead_created_at),
		signedUpAt: new Date(row.signed_up_at),
		paidAt: row.paid_at === null ? null : new Date(row.paid_at),
	};
}
