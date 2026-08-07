/**
 * The message that asks a subject to confirm the address their account is registered
 * under: one sentence, one button carrying a single-use token, and how long the link
 * lasts.
 *
 * It is the only message here that carries a secret, so it carries nothing else — no
 * account facts to correlate, and never a session id, which is this server's refresh
 * token. The link is built by the caller, which is also what decides the lifetime the
 * copy quotes, so the sentence and the token can never disagree about it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@pkg/i18n";
import type { Address, Email as EmailContract } from "@pkg/mail";
import type { RemixElement } from "remix/ui";

import { Email } from "@pkg/mail";

import { ACTION_BACKGROUND, EmailLayout } from "~/app/emails/layout";

export namespace VerifyEmailEmail {
	/** Everything the message needs; nothing is loaded while it renders. */
	export interface Data {
		/** The address being confirmed, which is also the only address this may go to. */
		email: string;
		/** Absolute URL carrying the verification token, already built by the sender. */
		url: string;
		/** How many minutes the link stays usable, quoted in the copy. */
		expiresInMinutes: number;
		/** Language the copy is produced in, recorded beside the translator it came from. */
		locale: string;
		/** Translator already bound to {@link locale} by the sender. */
		t: TFunction;
	}
}

/**
 * Asks a subject to confirm the address on their account.
 *
 * @example await mailer.send(new VerifyEmailEmail({ email, url, expiresInMinutes, locale, t }));
 */
export class VerifyEmailEmail implements EmailContract {
	/** The request this message was built from; nothing is loaded while rendering. */
	#verification: VerifyEmailEmail.Data;

	/**
	 * Creates the message.
	 *
	 * @param verification - The address to confirm, the link that confirms it, and the
	 *   language to write it in.
	 */
	constructor(verification: VerifyEmailEmail.Data) {
		this.#verification = verification;
	}

	/**
	 * The address being confirmed.
	 *
	 * It is deliberately the same value the token was issued for: a message proving an
	 * address that was delivered somewhere else proves nothing at all.
	 */
	get to(): Address {
		return { email: this.#verification.email };
	}

	/** Subject in the language the message was constructed for. */
	get subject(): string {
		return this.#verification.t("emails.verifyEmail.subject");
	}

	/**
	 * Body tree the mailer renders into both parts.
	 *
	 * The lifetime is stated next to the button rather than in the footer, because a
	 * reader who comes back to an expired link needs to know it expires before they click
	 * it, and the sentence also tells them where a fresh one comes from.
	 */
	body(): RemixElement {
		let { t, locale, url, expiresInMinutes } = this.#verification;

		return (
			<EmailLayout
				lang={locale}
				t={t}
				title={t("emails.verifyEmail.heading")}
				preview={t("emails.verifyEmail.preview")}
			>
				<Email.Heading>{t("emails.verifyEmail.heading")}</Email.Heading>
				<Email.Text>{t("emails.verifyEmail.body")}</Email.Text>
				<Email.Button href={url} background={ACTION_BACKGROUND}>
					{t("emails.verifyEmail.action")}
				</Email.Button>
				<Email.Text muted>
					{t("emails.verifyEmail.expiry", { minutes: expiresInMinutes })}
				</Email.Text>
				<Email.Text muted>{t("emails.verifyEmail.ignore")}</Email.Text>
			</EmailLayout>
		);
	}
}
