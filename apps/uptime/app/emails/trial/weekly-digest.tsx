/**
 * The last email of one URL's free watch: seven days as a bar and three numbers, then the one
 * call to action this family allows. One segment per day, each the worst status that day
 * produced, keeps an outage visible in the total; the subscribe link states the offer plainly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEmail, Email } from "@sdxc/mail";

import emails from "~/app/emails";
import { DARK_STYLES } from "~/app/emails/shared/palette";
import {
	TRIAL_MAILING_LIST,
	trialDisplayUrl,
	TrialFooter,
	TrialReport,
	trialUnsubscribeUrl,
} from "~/app/emails/shared/trial";

export default createEmail(emails.trial.weeklyDigest, {
	/** Names the URL and the window, so it reads as a report of the week that ended. */
	subject: ({ t, url }) => t("emails.trial.weekly.subject", { url: trialDisplayUrl(url) }),
	unsubscribe: ({ unsubscribeToken }) => ({ url: trialUnsubscribeUrl(unsubscribeToken) }),
	/** The trial list, shared by every trial email so one unsubscribe stops them all. */
	list: () => TRIAL_MAILING_LIST,
	/**
	 * The headline, the week's report, the sentence stating that the checks stop now, the
	 * subscribe button, and the footer, which links this report's own page when the sender
	 * supplied the watch's token.
	 */
	body: (handle) => () => {
		let { t, locale, url, segments, stats, subscribeUrl, reportToken, unsubscribeToken } =
			handle.props;
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
	},
	preview: () => ({
		url: "https://example.com",
		segments: ["up", "up", "down", "up", "up", "degraded", "up"],
		stats: { checks: 168, uptime: "99.4", slowestResponseMs: 2100 },
		subscribeUrl: "https://uptime.sergiodxa.com/app",
		reportToken: "preview",
		unsubscribeToken: "preview",
	}),
});
