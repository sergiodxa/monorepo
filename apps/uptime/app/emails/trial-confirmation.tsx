/**
 * The email that answers the address a visitor typed into the try-it page: the check
 * they just watched run, repeated back as a record, and a plain statement of what the
 * service is about to do with their URL for the next seven days.
 *
 * It is the first thing this sender ever puts in their inbox, so it is written as a
 * receipt rather than as a welcome: no pitch, no product tour, and the way to stop it
 * in the same message that starts it (ADR-030).
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
	TrialFooter,
	trialDateTime,
	trialDisplayUrl,
	trialStatusKey,
	trialUnsubscribeHeaders,
} from "~/app/emails/shared/trial";

export namespace TrialConfirmationEmail {
	/** Everything the confirmation needs, all of it from the check that just ran. */
	export interface Data {
		/** Address the visitor handed over; the only thing known about them. */
		to: string;
		/** URL they probed, reported verbatim. */
		url: string;
		/** What that probe returned. */
		status: TrialStatus;
		/** HTTP status the URL answered with, or `null` when it never answered. */
		responseStatus: number | null;
		/** How long it took to answer, or `null` when it never answered. */
		responseTimeMs: number | null;
		/** When the probe ran; passed in so a test can pin it. */
		checkedAt: Date;
		/** When the hourly re-checks stop, seven days out from {@link checkedAt}. */
		watchUntil: Date;
		/** The lead's unguessable token, which the footer link and the headers are built from. */
		unsubscribeToken: string;
		/** Language the copy is produced in, recorded beside the translator it came from. */
		locale: string;
		/** Translator already bound to {@link locale} by the sender. */
		t: TFunction;
	}
}

/**
 * Receipt for a free watch, sent the moment the address is handed over.
 *
 * @example ctx.email.later(new TrialConfirmationEmail({ ...check, locale, t }));
 */
export class TrialConfirmationEmail implements Email {
	/** The probe this email reports; nothing is loaded while rendering. */
	#trial: TrialConfirmationEmail.Data;

	/**
	 * Creates the email.
	 *
	 * @param trial - The probe, the watch window it opened, and the translator for it.
	 */
	constructor(trial: TrialConfirmationEmail.Data) {
		this.#trial = trial;
	}

	/** The address the visitor typed, which is also the one the copy is written for. */
	get to(): Address {
		return { email: this.#trial.to };
	}

	/** Subject naming the URL, so the receipt is findable by what it is about. */
	get subject(): string {
		return this.#trial.t("emails.trial.confirmation.subject", {
			url: trialDisplayUrl(this.#trial.url),
		});
	}

	/** One-click unsubscribe, for the clients that render their own button for it. */
	get headers(): Record<string, string> {
		return trialUnsubscribeHeaders(this.#trial.unsubscribeToken);
	}

	/**
	 * Body tree: the headline, what happens next, the check that just ran as a table,
	 * and the two footer sentences that say why this arrived and how to end it.
	 */
	body(): RemixElement {
		let { t, locale, url, watchUntil, unsubscribeToken } = this.#trial;
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
				<Email.Table rows={this.#rows()} />
				<Email.Footer>
					<TrialFooter
						unsubscribeToken={unsubscribeToken}
						reason={t("emails.trial.confirmation.footer")}
						t={t}
					/>
				</Email.Footer>
			</Email.Layout>
		);
	}

	/** The probe as the reader sees it: what was checked, what came back, and when. */
	#rows(): EmailTableRow[] {
		let { t, locale, url, status, responseStatus, responseTimeMs, checkedAt } = this.#trial;
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
}
