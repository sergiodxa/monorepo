/**
 * The report a URL's second submission earns instead of a second free week, since a
 * URL gets one free week per address per thirty days. Kept separate from
 * `TrialWeeklyDigestEmail` because that email's framing assumes the week just ended,
 * while a repeat submission can arrive mid-week or long after.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@sdxc/i18n";
import type { Address } from "@sdxc/mail";
import type { RemixElement } from "remix/ui";

import { Email } from "@sdxc/mail";

import type { TrialStats } from "~/app/emails/shared/trial";
import type { UptimeBar } from "~/app/emails/shared/uptime-bar";

import { DARK_STYLES } from "~/app/emails/shared/palette";
import {
	TrialReport,
	TrialFooter,
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
		/**
		 * The watch's own `report_token`, which turns the week into a page the reader can
		 * reopen or forward. Optional because a report link built from a missing token would
		 * be a 404 in an inbox forever, so a sender with no token omits the link.
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
 * The report a URL's second submission earns in place of a second free week.
 *
 * @example ctx.email.send(new TrialRepeatReportEmail({ ...report, subscribeUrl, locale, t }));
 */
export class TrialRepeatReportEmail implements Email {
	/** The already-resolved report this email carries; rendering only formats it. */
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
	 * Subject naming the URL and what is inside, so it reads as the report it is and
	 * gives the reader reason to open it.
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
		let {
			t,
			locale,
			url,
			watchingSince,
			segments,
			stats,
			subscribeUrl,
			reportToken,
			unsubscribeToken,
		} = this.#report;

		let display = trialDisplayUrl(url);
		let heading = t("emails.trial.repeat.heading", { url: display });

		return (
			<Email.Layout
				lang={locale}
				title={heading}
				preview={t("emails.trial.repeat.preview", { url: display })}
				darkStyles={DARK_STYLES}
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
					<TrialFooter
						reportToken={reportToken}
						unsubscribeToken={unsubscribeToken}
						reason={t("emails.trial.repeat.footer")}
						t={t}
					/>
				</Email.Footer>
			</Email.Layout>
		);
	}
}
