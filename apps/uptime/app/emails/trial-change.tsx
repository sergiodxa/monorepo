/**
 * The email an hourly re-check produces when it disagrees with the one before it:
 * what the URL is doing now, what it was doing until now, and the minute it changed.
 *
 * It is the shortest of the four on purpose. A reader who opens this has one question,
 * and every line that is not the answer to it delays the answer, so there is no
 * summary, no bar, and no call to action here (ADR-030).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@pkg/i18n";
import type { Address, EmailTableRow } from "@pkg/mail";
import type { RemixElement } from "remix/ui";

import { Email } from "@pkg/mail";

import type { TrialStatus } from "~/app/emails/shared/trial";

import {
	TrialUnsubscribe,
	trialDateTime,
	trialDisplayUrl,
	trialStatusKey,
	trialUnsubscribeHeaders,
} from "~/app/emails/shared/trial";

export namespace TrialChangeEmail {
	/** The transition, as the check that found it reported it. */
	export interface Data {
		/** Address watching this URL. */
		to: string;
		/** URL that changed, reported verbatim. */
		url: string;
		/** What the check just found. */
		status: TrialStatus;
		/** What every check before it had been finding. */
		previousStatus: TrialStatus;
		/** HTTP status the URL answered with, or `null` when it never answered. */
		responseStatus: number | null;
		/** How long it took to answer, or `null` when it never answered. */
		responseTimeMs: number | null;
		/** When the disagreeing check ran; passed in so a test can pin it. */
		changedAt: Date;
		/** The lead's unguessable token, which the footer link and the headers are built from. */
		unsubscribeToken: string;
		/** Language the copy is produced in, recorded beside the translator it came from. */
		locale: string;
		/** Translator already bound to {@link locale} by the sender. */
		t: TFunction;
	}
}

/**
 * Notification that a watched URL is doing something different from what it was.
 *
 * @example ctx.email.later(new TrialChangeEmail({ ...transition, locale, t }));
 */
export class TrialChangeEmail implements Email {
	/** The transition this email reports; nothing is loaded while rendering. */
	#change: TrialChangeEmail.Data;

	/**
	 * Creates the email.
	 *
	 * @param change - The transition, its time, and the translator for it.
	 */
	constructor(change: TrialChangeEmail.Data) {
		this.#change = change;
	}

	/** The address watching the URL that changed. */
	get to(): Address {
		return { email: this.#change.to };
	}

	/**
	 * Subject naming the URL and its new state, with no timestamp in it: the subject
	 * is read in a notification, where the reader already knows when it arrived.
	 */
	get subject(): string {
		let { t, url } = this.#change;
		return t("emails.trial.change.subject", {
			url: trialDisplayUrl(url),
			status: this.#status(),
		});
	}

	/** One-click unsubscribe, for the clients that render their own button for it. */
	get headers(): Record<string, string> {
		return trialUnsubscribeHeaders(this.#change.unsubscribeToken);
	}

	/** Body tree: the headline, one sentence of context, the report, and the footer. */
	body(): RemixElement {
		let { t, locale, url, changedAt, unsubscribeToken } = this.#change;
		let displayUrl = trialDisplayUrl(url);
		let heading = t("emails.trial.change.heading", { url: displayUrl, status: this.#status() });

		return (
			<Email.Layout
				lang={locale}
				title={heading}
				preview={t("emails.trial.change.preview", { url: displayUrl, status: this.#status() })}
			>
				<Email.Heading>{heading}</Email.Heading>
				<Email.Text>
					{t("emails.trial.change.body", { time: trialDateTime(changedAt, locale) })}
				</Email.Text>
				<Email.Table rows={this.#rows()} />
				<Email.Footer>
					{t("emails.trial.change.footer")} <TrialUnsubscribe token={unsubscribeToken} t={t} />
				</Email.Footer>
			</Email.Layout>
		);
	}

	/** The word the new state is reported with, shared by the subject and the body. */
	#status(): string {
		return this.#change.t(trialStatusKey(this.#change.status));
	}

	/** What changed, what it changed from, what came back, and when. */
	#rows(): EmailTableRow[] {
		let { t, locale, url, previousStatus, responseStatus, responseTimeMs, changedAt } =
			this.#change;
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
			{ label: t("emails.trial.fields.status"), value: this.#status() },
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
}
