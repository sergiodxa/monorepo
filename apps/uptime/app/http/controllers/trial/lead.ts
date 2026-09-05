/**
 * `POST /try/lead` turns a submitted probe into a week of hourly checks for the
 * email a visitor hands over: a lead row, a watch row, and a confirmation send.
 *
 * A free watch is capped to one per normalized URL every thirty days: the watch
 * row itself deletes after that window, so finding one live is the whole check.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { getServiceContainer } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
import { Database } from "remix/data-table";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import type { TrialProbeState } from "~/app/http/controllers/trial/session";
import type { SupportedLanguage } from "~/database/schema";

import Lead from "~/app/data/lead";
import TrialWatch, { TRIAL_WATCH_DURATION_DAYS } from "~/app/data/trial-watch";
import { TrialConfirmationEmail } from "~/app/emails/trial-confirmation";
import { TrialRepeatReportEmail } from "~/app/emails/trial-repeat-report";
import { renderTrialPage } from "~/app/http/controllers/trial/index";
import {
	TRIAL_PROBE,
	TRIAL_WATCH_REPEATED,
	TRIAL_WATCH_STARTED,
	takeTrialState,
} from "~/app/http/controllers/trial/session";
import { TrialLeadSchema } from "~/app/http/validators/trial";
import { segmentsOver, watchStats } from "~/app/lib/trial-report";
import { recordCost } from "~/app/services/cost";
import { hostnameOf, trackTrialMonitorStarted } from "~/app/services/funnel-events";
import { supportedLanguages } from "~/database/schema";
import routes from "~/routes/web";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Origin the report's call to action points at; the host this app is served from. */
const APP_ORIGIN = "https://uptime.sergiodxa.com";

/** POST /try/lead — records the lead, opens the watch, sends the receipt. */
export default createAction(routes.trial.lead, async (ctx) => {
	let session = ctx.get(Session);
	let back = redirect(routes.trial.check.index.href(), { status: redirect.Status.SeeOther });

	/**
	 * Removed from the session at the point that acts on the probe, which makes a
	 * double submit idempotent: a second submit finds nothing here and any watch
	 * already created stays the only one.
	 */
	let probe = takeTrialState<TrialProbeState>(session, TRIAL_PROBE);
	if (!probe) return back;

	let result = await validate(ctx.formData, TrialLeadSchema);
	if (isFailure(result)) {
		/**
		 * The probe goes back where it was. A mistyped address must not cost the visitor
		 * the check they just ran, which is the only thing on the page worth keeping, and
		 * the re-rendered page needs something to put the error next to.
		 */
		session?.set(TRIAL_PROBE, probe);
		return renderTrialPage({ probe, leadError: true });
	}

	let db = getServiceContainer().get(Database);
	let locale = toSupportedLanguage(ctx.locale);

	let lead = await Lead.upsertByEmail(db, {
		email: result.data.email,
		/**
		 * Always absent: the form now asks only for email and consent, and every message
		 * greets the recipient by email alone. `LeadInput` still names the column, so this
		 * stays until the column itself goes.
		 */
		locale,
		consented: result.data.consent,
	});

	ctx.log.set({ trial: { lead_id: lead.id } });

	/**
	 * The cap, and the whole of it: a row here means this normalized pair already
	 * had its free week, since a watch is deleted thirty days after creation and
	 * can only be found within that window.
	 */
	let existing = await TrialWatch.findByNormalizedUrl(db, lead.id, probe.url);

	if (existing) {
		ctx.log.set({ trial: { watch_id: existing.id, repeated: true } });

		let results = await TrialWatch.listResultsBetween(
			db,
			existing.id,
			existing.created_at,
			existing.expires_at,
		);

		/** Counted before the send, because a rejected send is a billed one. */
		recordCost("emailSent");
		let report = await ctx.email.send(
			new TrialRepeatReportEmail({
				to: lead.email,
				url: existing.url,
				watchingSince: new Date(existing.created_at),
				/**
				 * Anchored to when the watch itself started, so the bar reads as the promised
				 * week. Days not yet reached come back as `null` and draw as "no data".
				 */
				segments: segmentsOver(results, existing.created_at, MS_PER_DAY, TRIAL_WATCH_DURATION_DAYS),
				stats: watchStats(existing),
				subscribeUrl: `${APP_ORIGIN}${routes.app.index.href()}`,
				/**
				 * The report as a durable page: it answers a deliberate second submission with
				 * exactly what the watch already found, which is what the reader was reaching
				 * for.
				 */
				reportToken: existing.report_token,
				unsubscribeToken: lead.unsubscribe_token,
				locale,
				t: ctx.i18next.getFixedT(locale),
			}),
		);

		if (isFailure(report)) {
			ctx.log.warn("trial.repeat_report_email_failed", { message: report.error.message });
		} else {
			await Lead.recordEmailSent(db, lead.id);
		}

		/**
		 * A different receipt, because a different thing happened. Telling somebody we are now
		 * watching a URL we declined to start watching again would be the one lie this page can
		 * tell that they have no way to check.
		 */
		session?.set(TRIAL_WATCH_REPEATED, existing.url);
		return back;
	}

	let watch = await TrialWatch.create(db, lead.id, {
		url: probe.url,
		/**
		 * The status the visitor just saw, so change detection has a baseline from the very
		 * first hour instead of spending one establishing it — the watch's first check is an
		 * interval out precisely because this one already happened.
		 */
		last_status: probe.status,
	});

	ctx.log.set({ trial: { watch_id: watch.id, repeated: false } });

	/**
	 * Emitted from the branch that actually starts a watch: a repeat submission
	 * earns a report but adds no funnel step. Emitted before the send so a mail
	 * outage cannot cost the event.
	 */
	trackTrialMonitorStarted(ctx.log, {
		leadId: lead.id,
		watchId: watch.id,
		hostname: hostnameOf(probe.url),
		monitorType: "http",
		immediateCheckSucceeded: probe.status === "up",
		consented: result.data.consent,
	});

	/** Counted before the send, because a rejected send is a billed one. */
	recordCost("emailSent");

	let checkedAt = new Date(probe.checkedAt);
	/**
	 * Awaited directly so the funnel counts only emails actually received: the mail
	 * middleware flushes any queued send before the handler returns anyway, so
	 * awaiting here costs nothing extra.
	 */
	let sent = await ctx.email.send(
		new TrialConfirmationEmail({
			to: lead.email,
			url: probe.url,
			status: probe.status,
			responseStatus: probe.responseStatus,
			responseTimeMs: probe.responseTimeMs,
			checkedAt,
			watchUntil: new Date(probe.checkedAt + TRIAL_WATCH_DURATION_DAYS * MS_PER_DAY),
			unsubscribeToken: lead.unsubscribe_token,
			locale,
			t: ctx.i18next.getFixedT(locale),
		}),
	);

	if (isFailure(sent)) {
		ctx.log.warn("trial.confirmation_email_failed", { message: sent.error.message });
	} else {
		await Lead.recordEmailSent(db, lead.id);
	}

	session?.set(TRIAL_WATCH_STARTED, probe.url);
	return back;
});

/**
 * The request's language, narrowed to one the schema's enum and email
 * dictionaries both accept. `ctx.locale` already comes from the i18n
 * middleware's supported set; an unexpected value here becomes English.
 *
 * @param locale - The language the page was served in.
 * @returns A language the `leads.locale` column accepts.
 */
function toSupportedLanguage(locale: string): SupportedLanguage {
	let match = supportedLanguages.find((language) => language === locale);
	return match ?? "en";
}
