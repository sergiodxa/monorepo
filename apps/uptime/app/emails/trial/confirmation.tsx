/**
 * The email that answers the address a visitor typed into the try-it page: the check they
 * just watched run, repeated back as a record, and what the service does with their URL for
 * the next seven days. It carries the way to stop watching in the message that starts it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EmailInput, EmailPropsOutput, EmailTableRow } from "@sdxc/mail";

import { createEmail, Email } from "@sdxc/mail";

import emails from "~/app/emails";
import {
	TRIAL_MAILING_LIST,
	trialDateTime,
	trialDisplayUrl,
	TrialFooter,
	trialStatusKey,
	trialUnsubscribeUrl,
} from "~/app/emails/shared/trial";

/** What every member of the template reads: the probe, the reader's locale and `t`. */
type Trial = EmailInput<EmailPropsOutput<typeof emails.trial.confirmation>>;

export default createEmail(emails.trial.confirmation, {
	/** Names the URL, so the receipt is findable by what it is about. */
	subject: ({ t, url }) => t("emails.trial.confirmation.subject", { url: trialDisplayUrl(url) }),
	unsubscribe: ({ unsubscribeToken }) => ({ url: trialUnsubscribeUrl(unsubscribeToken) }),
	/** The trial list, shared by every trial email so one unsubscribe stops them all. */
	list: () => TRIAL_MAILING_LIST,
	/**
	 * The headline, what happens next, the check that just ran as a table, and the two footer
	 * sentences that say why this arrived and how to end it.
	 */
	body: (handle) => () => {
		let { t, locale, url, watchUntil, unsubscribeToken } = handle.props;
		let displayUrl = trialDisplayUrl(url);
		let heading = t("emails.trial.confirmation.heading", { url: displayUrl });

		return (
			<Email.Layout
				lang={locale}
				title={heading}
				preview={t("emails.trial.confirmation.preview", { url: displayUrl })}
			>
				<Email.Heading>{heading}</Email.Heading>
				<Email.Text>
					{t("emails.trial.confirmation.body", { until: trialDateTime(watchUntil, locale) })}
				</Email.Text>
				<Email.Table rows={rows(handle.props)} />
				<Email.Footer>
					<TrialFooter
						unsubscribeToken={unsubscribeToken}
						reason={t("emails.trial.confirmation.footer")}
						t={t}
					/>
				</Email.Footer>
			</Email.Layout>
		);
	},
	preview: () => ({
		url: "https://example.com",
		status: "up",
		responseStatus: 200,
		responseTimeMs: 143,
		checkedAt: Date.UTC(2026, 7, 1, 10),
		watchUntil: Date.UTC(2026, 7, 8, 10),
		unsubscribeToken: "preview",
	}),
});

/** The probe as the reader sees it: what was checked, what came back, and when. */
function rows(trial: Trial): EmailTableRow[] {
	let { t, locale, url, status, responseStatus, responseTimeMs, checkedAt } = trial;
	let none = t("emails.trial.values.none");

	return [
		{
			label: t("emails.trial.fields.url"),
			value: (
				<a href={url} style="color:inherit;text-decoration:none;">
					{trialDisplayUrl(url)}
				</a>
			),
		},
		{ label: t("emails.trial.fields.status"), value: t(trialStatusKey(status)) },
		{
			label: t("emails.trial.fields.responseStatus"),
			value: responseStatus === null ? none : String(responseStatus),
		},
		{
			label: t("emails.trial.fields.responseTime"),
			value:
				responseTimeMs === null
					? none
					: t("emails.trial.values.milliseconds", { value: responseTimeMs }),
		},
		{ label: t("emails.trial.fields.checkedAt"), value: trialDateTime(checkedAt, locale) },
	];
}
