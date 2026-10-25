/**
 * The email an hourly re-check produces when it disagrees with the one before it: what the
 * URL is doing now, what it was doing until now, and the minute it changed. It carries just
 * that answer, so the reader reaches it immediately.
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

/** What every member of the template reads: the transition, the reader's locale and `t`. */
type Change = EmailInput<EmailPropsOutput<typeof emails.trial.change>>;

export default createEmail(emails.trial.change, {
	/**
	 * Names the URL and its new state. A notification's arrival time is already known to the
	 * reader, so the timestamp belongs in the body.
	 */
	subject: (change) =>
		change.t("emails.trial.change.subject", {
			url: trialDisplayUrl(change.url),
			status: statusWord(change),
		}),
	unsubscribe: ({ unsubscribeToken }) => ({ url: trialUnsubscribeUrl(unsubscribeToken) }),
	/** The trial list, shared by every trial email so one unsubscribe stops them all. */
	list: () => TRIAL_MAILING_LIST,
	/** The headline, one sentence of context, the report, and the footer. */
	body: (handle) => () => {
		let { t, locale, url, changedAt, unsubscribeToken } = handle.props;
		let displayUrl = trialDisplayUrl(url);
		let status = statusWord(handle.props);
		let heading = t("emails.trial.change.heading", { url: displayUrl, status });

		return (
			<Email.Layout
				lang={locale}
				title={heading}
				preview={t("emails.trial.change.preview", { url: displayUrl, status })}
			>
				<Email.Heading>{heading}</Email.Heading>
				<Email.Text>
					{t("emails.trial.change.body", { time: trialDateTime(changedAt, locale) })}
				</Email.Text>
				<Email.Table rows={rows(handle.props)} />
				<Email.Footer>
					<TrialFooter
						unsubscribeToken={unsubscribeToken}
						reason={t("emails.trial.change.footer")}
						t={t}
					/>
				</Email.Footer>
			</Email.Layout>
		);
	},
	preview: () => ({
		url: "https://example.com",
		status: "down",
		previousStatus: "up",
		responseStatus: 503,
		responseTimeMs: 2100,
		changedAt: Date.UTC(2026, 7, 3, 14, 32),
		unsubscribeToken: "preview",
	}),
});

/** The word the new state is reported with, shared by the subject and the body. */
function statusWord({ t, status }: Change): string {
	return t(trialStatusKey(status));
}

/** What changed, what it changed from, what came back, and when. */
function rows(change: Change): EmailTableRow[] {
	let { t, locale, url, previousStatus, responseStatus, responseTimeMs, changedAt } = change;
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
		{ label: t("emails.trial.fields.status"), value: statusWord(change) },
		{
			label: t("emails.trial.fields.previousStatus"),
			value: t(trialStatusKey(previousStatus)),
		},
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
		{ label: t("emails.trial.fields.changedAt"), value: trialDateTime(changedAt, locale) },
	];
}
