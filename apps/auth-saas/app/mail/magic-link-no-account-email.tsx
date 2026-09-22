/**
 * Tells an address's real owner that a magic-link sign-in was attempted against
 * it and no account exists — the message `beginMagicLinkSignIn` sends instead of
 * a link when the address matches no subject, so the uniform page every request
 * renders stays honest rather than a fiction: the person who actually holds this
 * mailbox still learns that someone tried, even though nothing here can be
 * followed into a sign-in. Carries neither a token nor a code, since none was
 * ever minted for a use this message could authorize.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@sdxc/i18n";
import type { Address, Email as EmailContract } from "@sdxc/mail";
import type { RemixElement } from "remix/ui";

import { Email } from "@sdxc/mail";

import { AuthMailLayout } from "~/app/mail/layout";

export namespace MagicLinkNoAccountEmail {
	/** Everything the message needs; nothing is loaded while it renders. */
	export interface Data {
		/** The address a sign-in was attempted against — the only recipient this notice has. */
		email: string;
		/** The tenant's own display name, derived by the caller. */
		tenantName: string;
		/** Translator for the request's own locale. */
		t: TFunction;
	}
}

/**
 * Notifies an address with no matching subject that a sign-in was attempted.
 *
 * @example await ctx.email.send(new MagicLinkNoAccountEmail({ email, tenantName, t }));
 */
export class MagicLinkNoAccountEmail implements EmailContract {
	#data: MagicLinkNoAccountEmail.Data;

	constructor(data: MagicLinkNoAccountEmail.Data) {
		this.#data = data;
	}

	get to(): Address {
		return { email: this.#data.email };
	}

	get subject(): string {
		return this.#data.t("mail.magicLinkNoAccount.subject", { tenantName: this.#data.tenantName });
	}

	body(): RemixElement {
		let { t, tenantName } = this.#data;

		return (
			<AuthMailLayout
				title={t("mail.magicLinkNoAccount.subject", { tenantName })}
				preview={t("mail.magicLinkNoAccount.preview")}
				tenantName={tenantName}
				t={t}
			>
				<Email.Heading>{t("mail.magicLinkNoAccount.heading")}</Email.Heading>
				<Email.Text>{t("mail.magicLinkNoAccount.body", { tenantName })}</Email.Text>
				<Email.Text muted>{t("mail.magicLinkNoAccount.notice")}</Email.Text>
			</AuthMailLayout>
		);
	}
}
