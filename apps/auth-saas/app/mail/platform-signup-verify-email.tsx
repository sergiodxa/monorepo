/**
 * Asks a fresh platform signup to confirm the address it claims, with a link carrying
 * the single-use ticket `addIdentifier` minted for it. It carries no other account
 * fact, so an interceptor of this message learns only that a signup is pending for the
 * address it names.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Address, Email as EmailContract } from "@sdxc/mail";
import type { RemixElement } from "remix/component";

import { Email } from "@sdxc/mail";

import { AuthMailLayout } from "~/app/mail/layout";

/** The platform's own display name, the same one its landing page and document title carry. */
const PLATFORM_NAME = "Auth SaaS";

export namespace PlatformSignupVerifyEmail {
	/** Everything the message needs; nothing is loaded while it renders. */
	export interface Data {
		/** The address being confirmed, which is also the only address this may go to. */
		email: string;
		/** Absolute URL of `/signup/verify`, carrying the ticket `addIdentifier` minted. */
		url: string;
		/** Translator for the request's own locale. */
		t: Translate;
	}
}

/**
 * Confirms the address a platform signup claims, on the way to provisioning its
 * new tenant.
 *
 * @example await ctx.mail.send(new PlatformSignupVerifyEmail({ email, url, t }));
 */
export class PlatformSignupVerifyEmail implements EmailContract {
	#data: PlatformSignupVerifyEmail.Data;

	constructor(data: PlatformSignupVerifyEmail.Data) {
		this.#data = data;
	}

	/** The address being confirmed — the same one the ticket was minted for. */
	get to(): Address {
		return { email: this.#data.email };
	}

	get subject(): string {
		return this.#data.t("mail.platformSignupVerify.subject", { tenantName: PLATFORM_NAME });
	}

	body(): RemixElement {
		let { t, url } = this.#data;

		return (
			<AuthMailLayout
				title={t("mail.platformSignupVerify.subject", { tenantName: PLATFORM_NAME })}
				preview={t("mail.platformSignupVerify.preview")}
				tenantName={PLATFORM_NAME}
				t={t}
			>
				<Email.Heading>{t("mail.platformSignupVerify.heading")}</Email.Heading>
				<Email.Text>
					{t("mail.platformSignupVerify.body", { tenantName: PLATFORM_NAME })}
				</Email.Text>
				<Email.Button href={url}>{t("mail.platformSignupVerify.action")}</Email.Button>
				<Email.Text muted>
					<Email.Link href={url}>{url}</Email.Link>
				</Email.Text>
				<Email.Text muted>{t("mail.platformSignupVerify.unexpected")}</Email.Text>
			</AuthMailLayout>
		);
	}
}
