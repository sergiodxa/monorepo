/**
 * Daily job that counts yesterday's public-trial funnel, stores the day's stats, and emails
 * the summary to whoever operates the deployment.
 *
 * Every run writes a `trial_daily_stats` row regardless of whether it sends, since two of the
 * three source tables get swept within a month and that row is the only version of the day
 * that survives. Sending itself is opt-in per deployment through `FUNNEL_REPORT_TO`.
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { toDayKey, subDays } from "@sdxc/dates";
import { createJobHandler } from "@sdxc/jobs";
import { Mailer } from "@sdxc/mail";
import { isFailure } from "@sdxc/result";
import { getServiceContainer } from "@sdxc/service-container";
import { env } from "cloudflare:workers";

import type { TrialDailyCounters } from "~/app/data/trial-daily-stats";
import type { SelectTrialConversion } from "~/database/schema";

import Lead from "~/app/data/lead";
import { getYesterdayDateUtc, utcDayBounds } from "~/app/data/monitor-daily-stats";
import TrialConversion, { trialConversionUrls } from "~/app/data/trial-conversion";
import TrialDailyStats, { isEmptyDay } from "~/app/data/trial-daily-stats";
import TrialWatch from "~/app/data/trial-watch";
import { FunnelReportEmail } from "~/app/emails/funnel-report";
import jobs from "~/app/jobs";
import { recordCost } from "~/app/services/cost";

/**
 * How many days of context the report closes with, the reported day included.
 * Thirty is how long a trial attempt stays claimable, the shortest window in which a lead
 * from the start could still convert by the end, so totals are summed out of `trial_daily_stats`.
 */
const FUNNEL_TOTALS_DAYS = 30;

/**
 * The internal address the report goes to, when the running deployment names one.
 * Read structurally off `env`, so an unset variable is simply a supported state;
 * an empty string counts as absent too.
 *
 * @returns The recipient, or `null` when this deployment has none.
 */
function funnelReportRecipient(): string | null {
	let candidate: unknown = (env as { FUNNEL_REPORT_TO?: unknown }).FUNNEL_REPORT_TO;
	if (typeof candidate !== "string" || candidate.length === 0) return null;
	return candidate;
}

/**
 * Records the send's cost before attempting delivery, since a rejected send is still
 * billed.
 */
export default createJobHandler(jobs.sendFunnelReport, async (ctx) => {
	let mailer = getServiceContainer().get(Mailer);
	let date = getYesterdayDateUtc();
	let { start, end } = utcDayBounds(date);

	/**
	 * A lead belongs to no team, so with no weights recorded for it, the ledger attributes
	 * this run's cost to the platform, which is the accurate owner.
	 */

	let [leads, watches, paid, signups] = await Promise.all([
		Lead.countFunnelActivity(ctx.database, start, end),
		TrialWatch.countFunnelActivity(ctx.database, start, end),
		TrialConversion.listPaidBetween(ctx.database, start, end),
		TrialConversion.listSignedUpBetween(ctx.database, start, end),
	]);

	let counters: TrialDailyCounters = {
		newLeads: leads.created,
		urlsChecked: watches.created,
		/**
		 * Derived from the four stamps sends leave — confirmation, digest, change email,
		 * wrap-up — since nothing else records a send count; the confirmation figure is
		 * approximate because a rejected send still counts.
		 */
		emailsSent: watches.created + watches.changeEmails + watches.summaryEmails + leads.digestsSent,
		freeSignups: signups.length,
		paidConversions: paid.length,
	};

	/** Written first and unconditionally: the row outlives every table it was counted from. */
	await TrialDailyStats.upsertDay(ctx.database, { date, ...counters });

	let to = funnelReportRecipient();
	if (to === null) {
		ctx.logger.info("job.send_funnel_report.no_recipient", { date });
		return;
	}

	if (isEmptyDay(counters)) {
		ctx.logger.info("job.send_funnel_report.nothing_to_report", { date });
		return;
	}

	let totals = await TrialDailyStats.totalsBetween(ctx.database, startOfTotals(date), date);

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
		ctx.logger.error("job.send_funnel_report.email_failed", { date, error: sent.error.message });
		return;
	}

	ctx.logger.info("job.send_funnel_report.completed", { date, ...counters });
});

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
		attribution: describeAttribution(row),
	};
}

/**
 * The three attribution columns as one line, or `null` when the row carries none.
 * A campaign is shown with its source when both are present, since that pair is the
 * identifier an operator recognises; the landing path stands in alone otherwise.
 */
function describeAttribution(row: SelectTrialConversion): string | null {
	let campaign = [row.campaign_source, row.campaign_name].filter(Boolean).join("/");

	if (campaign && row.landing_path) return `${campaign} → ${row.landing_path}`;
	if (campaign) return campaign;

	return row.landing_path;
}
