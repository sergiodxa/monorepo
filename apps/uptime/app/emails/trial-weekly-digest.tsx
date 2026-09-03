/**
 * The last email of one URL's free watch: seven days as a bar and three numbers,
 * then the one call to action this family allows. One segment per day, each the
 * worst status that day produced, keeps an outage visible in the total. The
 * subscribe link states the offer plainly, since seven days of checks on the
 * reader's own URL is the argument (ADR-030).
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
		 * reopen — see `TrialFooter`. Omitted when missing, since a link built from no token
		 * would be a 404 in somebody's inbox forever.
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
	/** The already-resolved week this email reports; rendering only formats it. */
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

	/** Subject naming the URL and the window, so it reads as a report of the week that ended. */
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
					<TrialFooter
						reportToken={reportToken}
						unsubscribeToken={unsubscribeToken}
						reason={t("emails.trial.weekly.footer")}
						t={t}
					/>
				</Email.Footer>
			</Email.Layout>
		);
	}
}
