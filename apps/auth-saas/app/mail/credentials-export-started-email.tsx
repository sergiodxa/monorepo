/**
 * Tells a tenant owner that a credentials export just started: one request is about
 * to carry every stored password hash in the tenant out of the platform, so the
 * owners hear about it the moment it begins rather than only once it is done.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Address, Email as EmailContract } from "@sdxc/mail";
import type { RemixElement } from "remix/component";

import { Email } from "@sdxc/mail";

import { AuthMailLayout } from "~/app/mail/layout";

export namespace CredentialsExportStartedEmail {
	/** Everything the message needs; nothing is loaded while it renders. */
	export interface Data {
		/** The owner's own address this notice goes to. */
		email: string;
		/** The tenant's own display name. */
		tenantName: string;
		/** Translator for the message's own locale. */
		t: Translate;
	}
}

/**
 * Tells one tenant owner that a credentials export — carrying every subject's
 * stored password hash — has started.
 *
 * @example
 * await ctx.mail.send(new CredentialsExportStartedEmail({ email, tenantName, t }));
 */
export class CredentialsExportStartedEmail implements EmailContract {
	#data: CredentialsExportStartedEmail.Data;

	constructor(data: CredentialsExportStartedEmail.Data) {
		this.#data = data;
	}

	/** The owner's own address — the only recipient one notice has. */
	get to(): Address {
		return { email: this.#data.email };
	}

	get subject(): string {
		return this.#data.t("mail.credentialsExportStarted.subject", {
			tenantName: this.#data.tenantName,
		});
	}

	body(): RemixElement {
		let { t, tenantName } = this.#data;

		return (
			<AuthMailLayout
				title={t("mail.credentialsExportStarted.subject", { tenantName })}
				preview={t("mail.credentialsExportStarted.preview", { tenantName })}
				tenantName={tenantName}
				t={t}
			>
				<Email.Heading>{t("mail.credentialsExportStarted.heading")}</Email.Heading>
				<Email.Text>{t("mail.credentialsExportStarted.body", { tenantName })}</Email.Text>
				<Email.Text muted>{t("mail.credentialsExportStarted.notice")}</Email.Text>
			</AuthMailLayout>
		);
	}
}
