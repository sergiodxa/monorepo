/**
 * The answer to a URL that was submitted to the free page a second time inside its own
 * thirty days: everything the checks already running on it have found, instead of a second
 * free week.
 *
 * A URL gets one free week per address per thirty days, so a repeat submission cannot start
 * anything. It could have been refused silently, and refusing silently would have thrown
 * away the one moment where the reader is asking about a URL we already hold a week of real
 * measurements for. So the refusal *is* the report.
 *
 * ## Why this is its own class and not `TrialWeeklyDigestEmail` with different data
 *
 * The two render the same bar and the same three numbers, and they are still different
 * emails, because every framing sentence in the wrap-up is false here. Its subject calls
 * itself a seven-day report, its heading says "over the last seven days", its closing says
 * the checks stop now, and its footer says this is the last one — and a repeat submission
 * can arrive on day two of a week that is still running, or three weeks after one ended.
 * Parameterising all four would leave a class whose subject, heading, closing and footer are
 * all supplied by the caller, which is not a shared email but two emails sharing a file.
 *
 * What the two genuinely share is the report itself, and that is already extracted:
 * `TrialReport`, `TrialStats` and `UptimeBar` are components, and ADR-030 asks for exactly
 * that — a helper where real logic is shared, never a base class — so reuse here means
 * importing them rather than inheriting from the other email.
 *
 * The copy is written to be true whether or not the week has finished, which is what keeps
 * this to one class rather than one class with a branch. It never claims checking continues
 * and never claims it has stopped; it reports what was found, states the rule that stopped a
 * second week from starting, and offers the real product.
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

import {
	TrialReport,
	TrialUnsubscribe,
	trialDateTime,
	trialDisplayUrl,
	trialUnsubscribeHeaders,
} from "~/app/emails/shared/trial";

export namespace TrialRepeatReportEmail {
	/** What the existing watch on this URL has found, and the offer that replaces a new one. */
	export interface Data {
		/** Address the submission came from, as it was typed. */
		to: string;
		/** URL that was submitted again, reported verbatim. */
		url: string;
		/** When the watch that already covers it was opened. */
		watchingSince: Date;
		/** The watch's seven days, oldest first; a day with no checks is `null`. */
		segments: UptimeBar.Status[];
		/** The numbers under the bar, over everything that watch has checked. */
		stats: TrialStats;
		/** Absolute URL that starts a paid monitor for the same target. */
		subscribeUrl: string;
		/** The lead's unguessable token, which the footer link and the headers are built from. */
		unsubscribeToken: string;
		/** Language the copy is produced in, recorded beside the translator it came from. */
		locale: string;
		/** Translator already bound to {@link locale} by the sender. */
		t: TFunction;
	}
}

/**
 * The report a URL's second submission earns in place of a second free week.
 *
 * @example ctx.email.send(new TrialRepeatReportEmail({ ...report, subscribeUrl, locale, t }));
 */
export class TrialRepeatReportEmail implements Email {
	/** The report this email carries; nothing is loaded while rendering. */
	#report: TrialRepeatReportEmail.Data;

	/**
	 * Creates the email.
	 *
	 * @param report - The existing watch's segments and numbers, the subscribe link, and the
	 *   translator.
	 */
	constructor(report: TrialRepeatReportEmail.Data) {
		this.#report = report;
	}

	/** The address that submitted the URL, in the spelling they used. */
	get to(): Address {
		return { email: this.#report.to };
	}

	/**
	 * Subject naming the URL and what is inside, so it reads as the report it is rather than
	 * as a rejection notice the reader would have no reason to open.
	 */
	get subject(): string {
		return this.#report.t("emails.trial.repeat.subject", {
			url: trialDisplayUrl(this.#report.url),
		});
	}

	/**
	 * One-click unsubscribe. A repeat submission is still trial mail to a lead, so it carries
	 * the same RFC 8058 headers every other message in this family does.
	 */
	get headers(): Record<string, string> {
		return trialUnsubscribeHeaders(this.#report.unsubscribeToken);
	}

	/**
	 * Body tree: the headline, the sentence saying which submission is already covering this
	 * URL, the report, the sentence stating the rule that stopped a second week, the subscribe
	 * button, and the footer.
	 */
	body(): RemixElement {
		let { t, locale, url, watchingSince, segments, stats, subscribeUrl, unsubscribeToken } =
			this.#report;

		let display = trialDisplayUrl(url);
		let heading = t("emails.trial.repeat.heading", { url: display });

		return (
			<Email.Layout
				lang={locale}
				title={heading}
				preview={t("emails.trial.repeat.preview", { url: display })}
			>
				<Email.Heading>{heading}</Email.Heading>
				<Email.Text>
					{t("emails.trial.repeat.intro", {
						url: display,
						since: trialDateTime(watchingSince, locale),
					})}
				</Email.Text>
				<TrialReport
					segments={segments}
					stats={stats}
					rangeStart={t("emails.trial.repeat.rangeStart")}
					rangeEnd={t("emails.trial.repeat.rangeEnd")}
					t={t}
				/>
				<Email.Text>{t("emails.trial.repeat.closing", { url: display })}</Email.Text>
				<Email.Button href={subscribeUrl}>{t("emails.trial.repeat.action")}</Email.Button>
				<Email.Footer>
					{t("emails.trial.repeat.footer")} <TrialUnsubscribe token={unsubscribeToken} t={t} />
				</Email.Footer>
			</Email.Layout>
		);
	}
}
