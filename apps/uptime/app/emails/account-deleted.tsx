/**
 * The one email an erased account produces: confirmation, after the fact, that the deletion
 * asked for has actually happened. It is sent by the daily sweep just before the queued
 * request row — the only place this app ever held the address — is itself deleted.
 *
 * The body carries only that confirmation and an honest account of what is retained, since
 * there is nothing left for the reader to sign in to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@pkg/i18n";
import type { Address } from "@pkg/mail";
import type { RemixElement } from "remix/ui";

import { Email } from "@pkg/mail";

export namespace AccountDeletedEmail {
	/** Everything the confirmation needs, all of it captured when the deletion was requested. */
	export interface Data {
		/** Address the deletion request was made from, and the last use it is put to. */
		email: string;
		/** Language the copy is produced in, recorded beside the translator it came from. */
		locale: string;
		/** Translator already bound to {@link locale} by the sender. */
		t: TFunction;
	}
}

/**
 * Tells somebody their account is gone, and what is retained despite it.
 *
 * @example await mailer.send(new AccountDeletedEmail({ email, locale, t }));
 */
export class AccountDeletedEmail implements Email {
	/** The request this confirmation was built from, fully resolved before render. */
	#request: AccountDeletedEmail.Data;

	/**
	 * Creates the email.
	 *
	 * @param request - The deleted account's address, its language, and the translator for it.
	 */
	constructor(request: AccountDeletedEmail.Data) {
		this.#request = request;
	}

	/** The address the deletion was requested from; by now the only trace of the account. */
	get to(): Address {
		return { email: this.#request.email };
	}

	/** Subject in the language the email was constructed for. */
	get subject(): string {
		return this.#request.t("emails.accountDeleted.subject");
	}

	/**
	 * Body tree the mailer renders into both parts.
	 *
	 * The four retention notes are one `Text` each so each one survives the plain-text
	 * conversion as its own paragraph, since that part is where many readers see the message.
	 */
	body(): RemixElement {
		let { t, locale } = this.#request;

		return (
			<Email.Layout
				lang={locale}
				title={t("emails.accountDeleted.heading")}
				preview={t("emails.accountDeleted.preview")}
			>
				<Email.Heading>{t("emails.accountDeleted.heading")}</Email.Heading>
				<Email.Text>{t("emails.accountDeleted.body")}</Email.Text>
				<Email.Text>{t("emails.accountDeleted.retained.intro")}</Email.Text>
				<Email.Text>{t("emails.accountDeleted.retained.billing")}</Email.Text>
				<Email.Text>{t("emails.accountDeleted.retained.analytics")}</Email.Text>
				<Email.Text>{t("emails.accountDeleted.retained.logs")}</Email.Text>
				<Email.Text>{t("emails.accountDeleted.retained.identity")}</Email.Text>
				<Email.Text>{t("emails.accountDeleted.address")}</Email.Text>
				<Email.Footer>{t("emails.accountDeleted.footer")}</Email.Footer>
			</Email.Layout>
		);
	}
}
