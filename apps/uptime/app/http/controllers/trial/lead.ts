/**
 * `POST /try/lead` — turns the probe a visitor just watched run into a week of hourly
 * checks, addressed to the email they handed over.
 *
 * Three writes, in one direction: the address becomes a lead (or updates the one it
 * already has), the probed URL becomes a watch under it, and the confirmation goes out
 * reporting the check that was already on screen. Nothing here is billed and no Polar
 * customer is provisioned — a lead is not a user, and only signing up makes one.
 *
 * ## One free week per URL per thirty days
 *
 * The middle write is the one with a condition on it. A free watch is a week of hourly
 * outbound fetches given away for an email address, and without a cap the same person could
 * restart it on the same URL forever by submitting again whenever the last one lapsed. So
 * the pair `(lead, normalized URL)` is looked up first, and finding a row means this URL
 * already had its week — a watch is deleted thirty days after it is created, so the row's
 * existence *is* the window and no date arithmetic happens here.
 *
 * Both halves of that pair are normalized, because both had trivial bypasses: a trailing
 * slash, a fragment or a reordered query string made one URL into three, and a `+tag` made
 * one person into as many leads as they cared to type. `~/app/lib/trial-identity` holds both
 * reductions and the one it deliberately does not make — `http://` and `https://` are two
 * endpoints and get a week each.
 *
 * **A capped submission is answered, not swallowed.** It sends the report of what the
 * existing watch has already found on that URL, which is the one thing we can say that the
 * reader could not have got anywhere else, and the page says plainly that no second week was
 * started. Silence would read as a bug, and a bare refusal would spend the moment on nothing.
 *
 * ## What is trusted
 *
 * The URL, the status and the timings come out of the session, written there by `POST /try`
 * from a probe that went through `guardTrialProbe`. They are not read back from the form,
 * and the form has no hidden fields carrying them, because a watch is an hourly outbound
 * fetch for seven days: a form that named its own URL would let anyone schedule a week of
 * fetches at any target with one request and no probe. A submission arriving with no probe
 * in the session is therefore not an error to explain — it is a page that has nothing to
 * act on, so it goes back to `/try` to run a check first.
 *
 * ## Which answers redirect
 *
 * A rejected address changed nothing, so it re-renders `/try` with the result still on it
 * and the error on the field — the same thing `POST /try` does with its own answer. A
 * successful one has written rows and queued mail, so it redirects and leaves the receipt
 * in the session for `GET /try` to show once, which is what keeps a reload from opening a
 * second watch.
 *
 * ## Consent
 *
 * The marketing opt-in is an unticked checkbox and it is genuinely optional. Handing over
 * an address so we can report on *this URL* is not consent to be marketed to, and the
 * schema keeps those apart: `consented_at` stays null unless the box was ticked, the
 * digest and wrap-up emails go out either way because they are the service that was
 * asked for, and every other send has to read that column first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
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
	 * Removed here rather than by the page that rendered it: this is the request that acts
	 * on the probe, and taking it now is also what makes a double submit idempotent — the
	 * second one finds nothing and starts no second watch on the same check.
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
		 * Always absent: the form no longer asks for a name. An optional field is a toll
		 * charged for something we already said we do not need, and nothing we send greets
		 * anybody by name. `LeadInput` still names the column, so this stays until the
		 * column itself goes.
		 */
		locale,
		consented: result.data.consent,
	});

	/**
	 * The cap, and the whole of it. A row here means this pair already had its free week, and
	 * because a watch is deleted thirty days after it was created, a row can only be found
	 * while that thirty days is still open. The URL is normalized inside the lookup, so a
	 * trailing slash, a fragment or a reordered query string cannot walk past it.
	 */
	let existing = await TrialWatch.findByNormalizedUrl(db, lead.id, probe.url);

	if (existing) {
		let results = await TrialWatch.listResultsBetween(
			db,
			existing.id,
			existing.created_at,
			existing.expires_at,
		);

		// Counted before the send, because a rejected send is a billed one.
		recordCost("emailSent");
		let report = await ctx.email.send(
			new TrialRepeatReportEmail({
				to: lead.email,
				url: existing.url,
				watchingSince: new Date(existing.created_at),
				/**
				 * The watch's own seven days, anchored to when it started rather than to now, so
				 * the bar reads as the week that was promised. Days it has not reached yet come
				 * back as `null` and draw as "no data", which is the honest answer for a week
				 * still in progress.
				 */
				segments: segmentsOver(results, existing.created_at, MS_PER_DAY, TRIAL_WATCH_DURATION_DAYS),
				stats: watchStats(existing),
				subscribeUrl: `${APP_ORIGIN}${routes.app.index.href()}`,
				unsubscribeToken: lead.unsubscribe_token,
				locale,
				t: ctx.i18next.getFixedT(locale),
			}),
		);

		if (isFailure(report)) {
			ctx.logger.error("trial.lead.repeat_report_email_failed", {
				leadId: lead.id,
				watchId: existing.id,
				error: report.error.message,
			});
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

	await TrialWatch.create(db, lead.id, {
		url: probe.url,
		/**
		 * The status the visitor just saw, so change detection has a baseline from the very
		 * first hour instead of spending one establishing it — the watch's first check is an
		 * interval out precisely because this one already happened.
		 */
		last_status: probe.status,
	});

	// Counted before the send, because a rejected send is a billed one.
	recordCost("emailSent");

	let checkedAt = new Date(probe.checkedAt);
	/**
	 * Sent rather than queued with `later()`, because the funnel counts emails a lead actually
	 * received and only an awaited send says whether one was. It costs the response nothing:
	 * the mail middleware flushes its queue in a `finally` around the handler, so a deferred
	 * send is awaited before the response leaves anyway — `later()` moves a send after the
	 * handler, not out of the request. A rejection is logged and changes nothing else, exactly
	 * as it did when the middleware was the one logging it.
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
		ctx.logger.error("trial.lead.confirmation_email_failed", {
			leadId: lead.id,
			error: sent.error.message,
		});
	} else {
		await Lead.recordEmailSent(db, lead.id);
	}

	session?.set(TRIAL_WATCH_STARTED, probe.url);
	return back;
});

/**
 * The request's language, narrowed to one the schema's enum and the email dictionaries
 * both have. `ctx.locale` is already resolved from the supported set by the i18n
 * middleware; the narrowing exists so the column's type is satisfied without an assertion
 * and so an unexpected value writes English rather than a row the enum rejects.
 *
 * @param locale - The language the page was served in.
 * @returns A language the `leads.locale` column accepts.
 */
function toSupportedLanguage(locale: string): SupportedLanguage {
	let match = supportedLanguages.find((language) => language === locale);
	return match ?? "en";
}
