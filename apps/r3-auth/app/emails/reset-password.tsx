/**
 * The message that carries a password-recovery link: one action, the window it is good
 * for, and a line telling somebody who did not ask for it that ignoring it is enough.
 *
 * It is the only message this server sends that holds a credential, so it holds exactly
 * one and nothing else: no session id — that value *is* the refresh token — no account
 * facts a stranger who intercepted the mail could learn, and no address in the copy. The
 * link goes to a page that asks for a new password and nowhere else.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@pkg/i18n";
import type { Address, Email as EmailContract } from "@pkg/mail";
import type { RemixElement } from "remix/ui";

import { Email } from "@pkg/mail";

import { ACTION_BACKGROUND, EmailLayout } from "~/app/emails/layout";

export namespace ResetPasswordEmail {
	/** Everything the message needs, all of it decided when the reset was issued. */
	export interface Data {
		/** The subject's own address; a recovery link never goes anywhere else. */
		email: string;
		/** Absolute URL of the reset form, carrying the single-use token. */
		url: string;
		/** How many minutes the link stays usable, so the copy states its own deadline. */
		minutes: number;
		/** Language the copy is produced in, recorded beside the translator it came from. */
		locale: string;
		/** Translator already bound to {@link locale} by the sender. */
		t: TFunction;
	}
}

/**
 * Offers a subject a way back into their account.
 *
 * @example await mailer.send(new ResetPasswordEmail({ email, url, minutes, locale, t }));
 */
export class ResetPasswordEmail implements EmailContract {
	/** The issued reset this message was built from; nothing is loaded while rendering. */
	#reset: ResetPasswordEmail.Data;

	/**
	 * Creates the message.
	 *
	 * @param reset - Where it goes, the link it carries, how long that link lives, and the
	 *   language to write it in.
	 */
	constructor(reset: ResetPasswordEmail.Data) {
		this.#reset = reset;
	}

	/** The address the reset was requested for, which is the only place it may be sent. */
	get to(): Address {
		return { email: this.#reset.email };
	}

	/** Subject in the language the message was constructed for. */
	get subject(): string {
		return this.#reset.t("emails.resetPassword.subject");
	}

	/**
	 * Body tree the mailer renders into both parts.
	 *
	 * The deadline is stated in the copy rather than as a timestamp, because a reader in
	 * another time zone can act on "30 minutes" and has to do arithmetic on an hour. The
	 * plain link is repeated under the button for the clients that strip one and for the
	 * readers who want to see where it goes before following it.
	 */
	body(): RemixElement {
		let { t, locale, url, minutes } = this.#reset;

		return (
			<EmailLayout
				lang={locale}
				t={t}
				title={t("emails.resetPassword.heading")}
				preview={t("emails.resetPassword.preview")}
			>
				<Email.Heading>{t("emails.resetPassword.heading")}</Email.Heading>
				<Email.Text>{t("emails.resetPassword.body")}</Email.Text>
				<Email.Button href={url} background={ACTION_BACKGROUND}>
					{t("emails.resetPassword.action")}
				</Email.Button>
				<Email.Text muted>{t("emails.resetPassword.expiry", { minutes })}</Email.Text>
				<Email.Text muted>
					<Email.Link href={url}>{url}</Email.Link>
				</Email.Text>
				<Email.Text muted>{t("emails.resetPassword.unexpected")}</Email.Text>
			</EmailLayout>
		);
	}
}
