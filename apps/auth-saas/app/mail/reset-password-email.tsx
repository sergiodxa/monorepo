/**
 * Carries a password-recovery link: one action and nothing else, since this is the one
 * message this app sends holding a credential. It reaches only the address
 * `beginPasswordReset` resolved, never the identifier as typed, so an interceptor
 * learns just the address a reset is pending for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@sdxc/i18n";
import type { Address, Email as EmailContract } from "@sdxc/mail";
import type { RemixElement } from "remix/ui";

import { Email } from "@sdxc/mail";

import { AuthMailLayout } from "~/app/mail/layout";

export namespace ResetPasswordEmail {
	/** Everything the message needs; nothing is loaded while it renders. */
	export interface Data {
		/** The address `beginPasswordReset` resolved — the only recipient a reset has. */
		email: string;
		/** Absolute URL of `/u/reset`, carrying the ticket `beginPasswordReset` minted. */
		url: string;
		/** The tenant's own display name, derived by the caller. */
		tenantName: string;
		/** Translator for the request's own locale. */
		t: TFunction;
	}
}

/**
 * Offers a way back into an account whose reset was requested.
 *
 * @example await ctx.email.send(new ResetPasswordEmail({ email, url, tenantName, t }));
 */
export class ResetPasswordEmail implements EmailContract {
	#data: ResetPasswordEmail.Data;

	constructor(data: ResetPasswordEmail.Data) {
		this.#data = data;
	}

	get to(): Address {
		return { email: this.#data.email };
	}

	get subject(): string {
		return this.#data.t("mail.resetPassword.subject", { tenantName: this.#data.tenantName });
	}

	body(): RemixElement {
		let { t, url, tenantName } = this.#data;

		return (
			<AuthMailLayout
				title={t("mail.resetPassword.subject", { tenantName })}
				preview={t("mail.resetPassword.preview")}
				tenantName={tenantName}
				t={t}
			>
				<Email.Heading>{t("mail.resetPassword.heading")}</Email.Heading>
				<Email.Text>{t("mail.resetPassword.body", { tenantName })}</Email.Text>
				<Email.Button href={url}>{t("mail.resetPassword.action")}</Email.Button>
				<Email.Text muted>
					<Email.Link href={url}>{url}</Email.Link>
				</Email.Text>
				<Email.Text muted>{t("mail.resetPassword.unexpected")}</Email.Text>
			</AuthMailLayout>
		);
	}
}
