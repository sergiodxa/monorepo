/**
 * The last email of one URL's free watch: the whole seven days as a bar and three
 * numbers, then the one call to action this family is allowed.
 *
 * Its unit is the URL, not the address, because what it marks is the end of *that*
 * URL's week — a lead who tried three URLs on three different days gets three of these
 * on three different days. That is the opposite unit from the daily digest, which
 * gathers a whole address into one message, so the two are separate classes with
 * separate data rather than one class with a window parameter. They still share the
 * bar and the totals block, which is the part that genuinely is the same.
 *
 * The bar is one segment per day, not per hour. 168 hourly segments across the 552px
 * the layout leaves would be about 1px each once the gutters are taken out, below the
 * width several clients round away entirely; seven segments also matches the promise
 * the confirmation made, so the row reads as the week that was watched. Each segment
 * is the worst status that day produced, because a summary that hid an outage inside
 * an average would be the one number a reader could not act on.
 *
 * The subscribe link carries no persuasion copy. Seven days of checks on the reader's
 * own URL is the argument, and a sentence claiming as much on top of it would only
 * make the report look like it needed help (ADR-030).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@pkg/i18n";
import type { Address } from "@pkg/mail";
import type { RemixElement } from "remix/ui";

import { Email } from "@pkg/mail";

import type { TrialStats } from "~/app/emails/shared/trial";
import type { UptimeBar } from "~/app/emails/shared/uptime-bar";

import { DARK_STYLES } from "~/app/emails/shared/palette";
import {
	TrialReport,
	TrialReportLink,
	TrialUnsubscribe,
	trialDisplayUrl,
	trialUnsubscribeHeaders,
} from "~/app/emails/shared/trial";

export namespace TrialWeeklyDigestEmail {
	/** One URL's completed week, and the link that keeps it being watched. */
	export interface Data {
		/** Address that has been watching this URL. */
		to: string;
		/** URL whose week just ended, reported verbatim. */
		url: string;
		/** The seven days, oldest first; a day with no checks is `null`. */
		segments: UptimeBar.Status[];
		/** The numbers under the bar, over the whole week. */
		stats: TrialStats;
		/** Absolute URL that starts a paid monitor for the same target. */
		subscribeUrl: string;
		/**
		 * The watch's own `report_token`, which turns this report into a page the reader can
		 * reopen — see `TrialReportLink`. Omitted when the sender has no token to give: a mail
		 * is worth sending without the link, and a report link built from a missing token would
		 * be a 404 in somebody's inbox forever.
		 */
		reportToken?: string;
		/** The lead's unguessable token, which the footer link and the headers are built from. */
		unsubscribeToken: string;
		/** Language the copy is produced in, recorded beside the translator it came from. */
		locale: string;
		/** Translator already bound to {@link locale} by the sender. */
		t: TFunction;
	}
}

/**
 * The seven-day summary that closes one URL's free watch and offers to keep it running.
 *
 * @example ctx.email.later(new TrialWeeklyDigestEmail({ ...week, subscribeUrl, locale, t }));
 */
export class TrialWeeklyDigestEmail implements Email {
	/** The week this email reports; nothing is loaded while rendering. */
	#digest: TrialWeeklyDigestEmail.Data;

	/**
	 * Creates the email.
	 *
	 * @param digest - The week's segments and numbers, the subscribe link, and the translator.
	 */
	constructor(digest: TrialWeeklyDigestEmail.Data) {
		this.#digest = digest;
	}

	/** The address that has been watching this URL for a week. */
	get to(): Address {
		return { email: this.#digest.to };
	}

	/** Subject naming the URL and the window, so it reads as a report rather than an offer. */
	get subject(): string {
		return this.#digest.t("emails.trial.weekly.subject", {
			url: trialDisplayUrl(this.#digest.url),
		});
	}

	/** One-click unsubscribe, for the clients that render their own button for it. */
	get headers(): Record<string, string> {
		return trialUnsubscribeHeaders(this.#digest.unsubscribeToken);
	}

	/**
	 * Body tree: the headline, the week's report, the sentence stating that the checks
	 * stop now, the subscribe button, and the footer — which also carries the link to this
	 * report's own page whenever the sender supplied the watch's token.
	 */
	body(): RemixElement {
		let { t, locale, url, segments, stats, subscribeUrl, reportToken, unsubscribeToken } =
			this.#digest;
		let heading = t("emails.trial.weekly.heading", { url: trialDisplayUrl(url) });

		return (
			<Email.Layout
				lang={locale}
				title={heading}
				preview={t("emails.trial.weekly.preview", { url: trialDisplayUrl(url) })}
				darkStyles={DARK_STYLES}
			>
				<Email.Heading>{heading}</Email.Heading>
				<TrialReport
					segments={segments}
					stats={stats}
					rangeStart={t("emails.trial.weekly.rangeStart")}
					rangeEnd={t("emails.trial.weekly.rangeEnd")}
					t={t}
				/>
				<Email.Text>{t("emails.trial.weekly.closing", { url: trialDisplayUrl(url) })}</Email.Text>
				<Email.Button href={subscribeUrl}>{t("emails.trial.weekly.action")}</Email.Button>
				<Email.Footer>
					{reportToken ? <TrialReportLink token={reportToken} t={t} /> : null}
					{t("emails.trial.weekly.footer")} <TrialUnsubscribe token={unsubscribeToken} t={t} />
				</Email.Footer>
			</Email.Layout>
		);
	}
}
