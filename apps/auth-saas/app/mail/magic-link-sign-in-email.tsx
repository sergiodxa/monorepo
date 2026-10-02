/**
 * Carries a magic-link sign-in's own two secrets: the link, whose `GET` consumes
 * nothing, and the eight-character code beside it, so a person reading this on a
 * different device can carry the code back to the browser that asked rather than
 * needing the link to follow them there. It reaches only the address
 * `beginMagicLinkSignIn` resolved to a subject, never the identifier as typed, so
 * an interceptor of this message learns just the address a sign-in is pending for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Address, Email as EmailContract } from "@sdxc/mail";
import type { RemixElement } from "remix/component";

import { Email } from "@sdxc/mail";

import { AuthMailLayout } from "~/app/mail/layout";

export namespace MagicLinkSignInEmail {
	/** Everything the message needs; nothing is loaded while it renders. */
	export interface Data {
		/** The address `beginMagicLinkSignIn` resolved — the only recipient a sign-in has. */
		email: string;
		/** Absolute URL of the link-landing route, carrying the token `beginMagicLinkSignIn` minted. */
		url: string;
		/** The eight-character code, already grouped `XXXX-XXXX`, for the browser that asked. */
		code: string;
		/** The tenant's own display name, derived by the caller. */
		tenantName: string;
		/** Translator for the request's own locale. */
		t: Translate;
	}
}

/**
 * Offers a way to finish a magic-link sign-in, by the link or by the code.
 *
 * @example await ctx.email.send(new MagicLinkSignInEmail({ email, url, code, tenantName, t }));
 */
export class MagicLinkSignInEmail implements EmailContract {
	#data: MagicLinkSignInEmail.Data;

	constructor(data: MagicLinkSignInEmail.Data) {
		this.#data = data;
	}

	get to(): Address {
		return { email: this.#data.email };
	}

	get subject(): string {
		return this.#data.t("mail.magicLinkSignIn.subject", { tenantName: this.#data.tenantName });
	}

	body(): RemixElement {
		let { t, url, code, tenantName } = this.#data;

		return (
			<AuthMailLayout
				title={t("mail.magicLinkSignIn.subject", { tenantName })}
				preview={t("mail.magicLinkSignIn.preview")}
				tenantName={tenantName}
				t={t}
			>
				<Email.Heading>{t("mail.magicLinkSignIn.heading", { tenantName })}</Email.Heading>
				<Email.Text>{t("mail.magicLinkSignIn.body", { tenantName })}</Email.Text>
				<Email.Button href={url}>{t("mail.magicLinkSignIn.action")}</Email.Button>
				<Email.Text muted>
					<Email.Link href={url}>{url}</Email.Link>
				</Email.Text>
				<Email.Text>
					{t("mail.magicLinkSignIn.codeIntro")} <Email.CodeInline>{code}</Email.CodeInline>
				</Email.Text>
				<Email.Text muted>{t("mail.magicLinkSignIn.unexpected")}</Email.Text>
			</AuthMailLayout>
		);
	}
}
