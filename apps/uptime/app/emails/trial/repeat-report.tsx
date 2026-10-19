/**
 * The report a URL's second submission earns instead of a second free week, since a URL gets
 * one free week per address per thirty days. Its framing holds for a submission arriving
 * mid-week or long after, where the weekly wrap-up assumes the week just ended.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEmail, Email } from "@sdxc/mail";

import emails from "~/app/emails";
import { DARK_STYLES } from "~/app/emails/shared/palette";
import {
	TRIAL_MAILING_LIST,
	trialDateTime,
	trialDisplayUrl,
	TrialFooter,
	TrialReport,
	trialUnsubscribeUrl,
} from "~/app/emails/shared/trial";

export default createEmail(emails.trial.repeatReport, {
	/** Names the URL and what is inside, so it reads as the report it is. */
	subject: ({ t, url }) => t("emails.trial.repeat.subject", { url: trialDisplayUrl(url) }),
	/** A repeat submission is still trial mail to a lead, so it carries the same one-click target. */
	unsubscribe: ({ unsubscribeToken }) => ({ url: trialUnsubscribeUrl(unsubscribeToken) }),
	/** The trial list, shared by every trial email so one unsubscribe stops them all. */
	list: () => TRIAL_MAILING_LIST,
	/**
	 * The headline, which submission is already covering this URL, the report, the rule that
	 * stopped a second week, the subscribe button, and the footer.
	 */
	body: (handle) => () => {
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
		} = handle.props;

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
	},
	preview: () => ({
		url: "https://example.com",
		watchingSince: Date.UTC(2026, 6, 30, 9, 15),
		segments: ["up", "up", "up", null, null, null, null],
		stats: { checks: 72, uptime: "98.6", slowestResponseMs: 1400 },
		subscribeUrl: "https://uptime.sergiodxa.com/app",
		reportToken: "preview",
		unsubscribeToken: "preview",
	}),
});
