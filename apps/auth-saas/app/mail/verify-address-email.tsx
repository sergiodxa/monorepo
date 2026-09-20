/**
 * Asks a subject to confirm the address their account claims, with a link carrying the
 * single-use ticket `addIdentifier` minted for it. It carries no other account fact, so
 * an interceptor of this message learns only that a signup or an address change is
 * pending for the address it names.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@sdxc/i18n";
import type { Address, Email as EmailContract } from "@sdxc/mail";
import type { RemixElement } from "remix/ui";

import { Email } from "@sdxc/mail";

import { AuthMailLayout } from "~/app/mail/layout";

export namespace VerifyAddressEmail {
	/** Everything the message needs; nothing is loaded while it renders. */
	export interface Data {
		/** The address being confirmed, which is also the only address this may go to. */
		email: string;
		/** Absolute URL of `/u/verify`, carrying the ticket `addIdentifier` minted. */
		url: string;
		/** The tenant's own display name, derived by the caller. */
		tenantName: string;
		/** Translator for the request's own locale. */
		t: TFunction;
	}
}

/**
 * Confirms the address a signup or an address change claims.
 *
 * @example await ctx.email.send(new VerifyAddressEmail({ email, url, tenantName, t }));
 */
export class VerifyAddressEmail implements EmailContract {
	#data: VerifyAddressEmail.Data;

	constructor(data: VerifyAddressEmail.Data) {
		this.#data = data;
	}

	/** The address being confirmed — the same one the ticket was minted for. */
	get to(): Address {
		return { email: this.#data.email };
	}

	get subject(): string {
		return this.#data.t("mail.verifyAddress.subject", { tenantName: this.#data.tenantName });
	}

	body(): RemixElement {
		let { t, url, tenantName } = this.#data;

		return (
			<AuthMailLayout
				title={t("mail.verifyAddress.subject", { tenantName })}
				preview={t("mail.verifyAddress.preview")}
				tenantName={tenantName}
				t={t}
			>
				<Email.Heading>{t("mail.verifyAddress.heading")}</Email.Heading>
				<Email.Text>{t("mail.verifyAddress.body", { tenantName })}</Email.Text>
				<Email.Button href={url}>{t("mail.verifyAddress.action")}</Email.Button>
				<Email.Text muted>
					<Email.Link href={url}>{url}</Email.Link>
				</Email.Text>
			</AuthMailLayout>
		);
	}
}
