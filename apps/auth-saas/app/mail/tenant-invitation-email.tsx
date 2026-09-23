/**
 * Carries an invitation to administer a tenant's dashboard: the tenant's own name,
 * the role being offered, and a link to accept it. The link's destination is a
 * placeholder — `https://dashboard.{PLATFORM_DOMAIN}/invitations/accept?token=…` —
 * since no dashboard application exists anywhere in this codebase yet to serve it;
 * the accept endpoint a later pass adds gives this URL somewhere real to resolve
 * once that dashboard exists.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Address, Email as EmailContract } from "@sdxc/mail";
import type { RemixElement } from "remix/ui";

import { Email } from "@sdxc/mail";

import type { TenantMemberInvitationRole } from "~/app/models/tenant-member-invitation";

import { AuthMailLayout } from "~/app/mail/layout";

export namespace TenantInvitationEmail {
	/** Everything the message needs; nothing is loaded while it renders. */
	export interface Data {
		/** The address the invitation was minted for. */
		email: string;
		/** The tenant's own display name. */
		tenantName: string;
		/** The role the invitation offers. */
		role: TenantMemberInvitationRole;
		/** Absolute URL a person follows to accept the invitation. */
		url: string;
		/** Translator for the message's own locale. */
		t: Translate;
	}
}

/**
 * Invites an address to administer a tenant's dashboard at a given role.
 *
 * @example
 * await ctx.mail.send(new TenantInvitationEmail({ email, tenantName, role, url, t }));
 */
export class TenantInvitationEmail implements EmailContract {
	#data: TenantInvitationEmail.Data;

	constructor(data: TenantInvitationEmail.Data) {
		this.#data = data;
	}

	/** The invited address — the only recipient an invitation has. */
	get to(): Address {
		return { email: this.#data.email };
	}

	get subject(): string {
		return this.#data.t("mail.tenantInvitation.subject", { tenantName: this.#data.tenantName });
	}

	body(): RemixElement {
		let { t, url, tenantName, role } = this.#data;

		return (
			<AuthMailLayout
				title={t("mail.tenantInvitation.subject", { tenantName })}
				preview={t("mail.tenantInvitation.preview", { tenantName })}
				tenantName={tenantName}
				t={t}
			>
				<Email.Heading>{t("mail.tenantInvitation.heading")}</Email.Heading>
				<Email.Text>{t("mail.tenantInvitation.body", { tenantName, role })}</Email.Text>
				<Email.Button href={url}>{t("mail.tenantInvitation.action")}</Email.Button>
				<Email.Text muted>
					<Email.Link href={url}>{url}</Email.Link>
				</Email.Text>
				<Email.Text muted>{t("mail.tenantInvitation.unexpected")}</Email.Text>
			</AuthMailLayout>
		);
	}
}
