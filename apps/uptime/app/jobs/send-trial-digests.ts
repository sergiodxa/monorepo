/**
 * Background job that sends the free trial's daily digest: one email per lead
 * covering every URL they are watching, keyed off `leads.last_digest_at` so a
 * redelivered trigger finds nothing left to do.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CurrentJobContext } from "@pkg/jobs-next";

import { createJobHandler } from "@pkg/jobs-next";
import { Mailer } from "@pkg/mail";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";

import type { TrialWatchDigestEntry } from "~/app/data/trial-watch";
import type { TrialStats } from "~/app/emails/shared/trial";
import type { SelectLead, SelectTrialWatchResult } from "~/database/schema";

import Lead from "~/app/data/lead";
import TrialWatch, { isHealthyTrialStatus } from "~/app/data/trial-watch";
import { emailTranslator } from "~/app/emails/locale";
import { TrialDailyDigestEmail } from "~/app/emails/trial-daily-digest";
import jobs from "~/app/jobs";
import { mapWithConcurrency } from "~/app/lib/concurrency";
import { segmentsOver } from "~/app/lib/trial-report";
import { formatUptime } from "~/app/lib/uptime-report";
import { recordCost } from "~/app/services/cost";
import { trackTrialProgressEmailSent } from "~/app/services/funnel-events";

const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * How many hours one digest reports, one segment of its bar per hour: a rolling
 * window ending now rather than the UTC calendar day, so a run shortly after
 * midnight tiles the prior day with no gap and matches the bar's own captions.
 */
const DIGEST_WINDOW_HOURS = 24;

export default createJobHandler(jobs.sendTrialDigests, async (ctx) => {
	let mailer = getServiceContainer().get(Mailer);
	/**
	 * One instant for the whole run, so the window every digest reports and the stamp every
	 * lead receives agree with the query that selected them.
	 */
	let now = Date.now();

	let leads = await Lead.listDueForDigest(ctx.database, now);

	/**
	 * A lead belongs to no team, so this cost is recorded with no weights: the ledger
	 * attributes it to `PLATFORM_TEAM_ID` under a `platform` attribution, the accurate
	 * account, since naming a team id here would misattribute it as `direct` spend.
	 */

	let settled = await mapWithConcurrency(leads, (lead) => digest(ctx, mailer, lead, now));

	let sent = 0;
	let skipped = 0;
	let errorCount = 0;

	for (let outcome of settled) {
		if (!outcome.ok) {
			errorCount++;
			ctx.logger.error("job.send_trial_digests.lead_failed", {
				leadId: outcome.item.id,
				error: outcome.error instanceof Error ? outcome.error.message : String(outcome.error),
			});
			continue;
		}

		if (outcome.value) sent++;
		else skipped++;
	}

	ctx.logger.info("job.send_trial_digests.completed", {
		total: leads.length,
		sent,
		skipped,
		errorCount,
	});
});

/**
 * Sends one lead their whole day: every target they are still watching, in the language
 * they were browsing in when they handed the address over. Cost is recorded before the
 * send attempt, since a rejected send is still billed.
 *
 * @returns Whether a digest went out, which is what the stamp and the counters key on.
 */
async function digest(
	ctx: CurrentJobContext,
	mailer: Mailer,
	lead: SelectLead,
	now: number,
): Promise<boolean> {
	let since = now - DIGEST_WINDOW_HOURS * MS_PER_HOUR;
	let entries = await TrialWatch.listDigestForLead(ctx.database, lead.id, since);

	let targets = entries.map((entry) => toTarget(entry, since)).filter((target) => target !== null);

	if (targets.length === 0) {
		ctx.logger.info("job.send_trial_digests.nothing_to_report", { leadId: lead.id });
		return false;
	}

	let { locale, t } = await emailTranslator(lead.locale);

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
		ctx.logger.error("job.send_trial_digests.email_failed", {
			leadId: lead.id,
			error: result.error.message,
		});
		return false;
	}

	/** Only now: the stamp is what moves this lead's next digest to tomorrow. */
	await Lead.markDigestSent(ctx.database, lead.id, now);
	/** And on the same condition, since the funnel counts sends that landed. */
	await Lead.recordEmailSent(ctx.database, lead.id, now);

	/**
	 * On the same condition again, and with no URL in it: how many targets the email covered
	 * and whether any of them was unhealthy is the whole of what makes one of these worth
	 * having opened, and it is the part that cannot be recovered once the lead is deleted.
	 */
	trackTrialProgressEmailSent(ctx.logger, {
		leadId: lead.id,
		period: "daily",
		targets: targets.length,
		hadIncident: targets.some((target) => !isHealthyTrialStatus(target.status)),
	});

	return true;
}

/**
 * One watched target as its section of the digest, or `null` for a watch that has
 * never completed a check and so has no honest status to print. A target with no
 * checks in the window still gets a section, since an all-empty bar is itself the report.
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
 * The three numbers under a daily bar, derived from the window's rows rather than the
 * watch's lifetime totals, which would describe a span the reader isn't looking at. A
 * slowest response of zero means nothing answered, since a measured response has a duration.
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
