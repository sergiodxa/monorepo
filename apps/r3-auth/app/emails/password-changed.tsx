/**
 * The notice a subject receives once their password has actually been changed through a
 * recovery link, and once every session on the account has been ended.
 *
 * It is sent because a completed reset is the last cheap moment to reverse a takeover: the
 * reset mail itself can be deleted from a mailbox somebody else is reading, while this one
 * arrives after the fact and states plainly what happened. It carries no token and no link
 * that acts on the account — only a way back to signing in — and the reply-to address on
 * it reaches a person.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@pkg/i18n";
import type { Address, Email as EmailContract } from "@pkg/mail";
import type { RemixElement } from "remix/ui";

import { Email } from "@pkg/mail";

import { ISSUER_HOST } from "~/app/config";
import { ACTION_BACKGROUND, EmailLayout } from "~/app/emails/layout";
import routes from "~/routes/web";

export namespace PasswordChangedEmail {
	/** Everything the notice reports, which is deliberately almost nothing. */
	export interface Data {
		/** The subject's own address, which is who the notice is addressed to. */
		email: string;
		/** Language the copy is produced in, recorded beside the translator it came from. */
		locale: string;
		/** Translator already bound to {@link locale} by the sender. */
		t: TFunction;
	}
}

/**
 * Tells a subject that their password was changed and their sessions were ended.
 *
 * @example await mailer.send(new PasswordChangedEmail({ email, locale, t }));
 */
export class PasswordChangedEmail implements EmailContract {
	/** The account this notice is about; nothing is loaded while rendering. */
	#account: PasswordChangedEmail.Data;

	/**
	 * Creates the notice.
	 *
	 * @param account - Where it goes and the language to write it in.
	 */
	constructor(account: PasswordChangedEmail.Data) {
		this.#account = account;
	}

	/** The subject's own address; a security notice never goes anywhere else. */
	get to(): Address {
		return { email: this.#account.email };
	}

	/** Subject in the language the notice was constructed for. */
	get subject(): string {
		return this.#account.t("emails.passwordChanged.subject");
	}

	/**
	 * Body tree the mailer renders into both parts.
	 *
	 * The sign-out is reported as well as the change, because it is the part a reader
	 * notices on their other devices and an unexplained sign-out reads as a fault.
	 */
	body(): RemixElement {
		let { t, locale } = this.#account;

		return (
			<EmailLayout
				lang={locale}
				t={t}
				title={t("emails.passwordChanged.heading")}
				preview={t("emails.passwordChanged.preview")}
			>
				<Email.Heading>{t("emails.passwordChanged.heading")}</Email.Heading>
				<Email.Text>{t("emails.passwordChanged.body")}</Email.Text>
				<Email.Text>{t("emails.passwordChanged.sessions")}</Email.Text>
				<Email.Button href={signInUrl()} background={ACTION_BACKGROUND}>
					{t("emails.passwordChanged.action")}
				</Email.Button>
				<Email.Text muted>{t("emails.passwordChanged.unexpected")}</Email.Text>
			</EmailLayout>
		);
	}
}

/**
 * Absolute URL of the sign-in entry point.
 *
 * Built from the typed route so it cannot drift from the route table, and against the
 * published issuer host because a relative href in mail resolves against nothing. It acts
 * on nothing by itself: following it only offers the ways in this server already offers.
 */
function signInUrl(): string {
	return new URL(routes.authorize.index.href(), ISSUER_HOST).toString();
}
