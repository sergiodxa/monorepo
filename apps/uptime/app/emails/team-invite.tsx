/**
 * The email a team admin's invite produces: the recipient, the translated subject,
 * and the body all derive from the one object the invite was created with, so the
 * address always agrees with the team the copy names (ADR-030).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@sdxc/i18n";
import type { Address } from "@sdxc/mail";
import type { RemixElement } from "remix/ui";

import { Email } from "@sdxc/mail";

export namespace TeamInviteEmail {
	/** Everything the invite email needs, already loaded by whoever sends it. */
	export interface Data {
		/** Display name of the team the recipient is invited to. */
		team: string;
		/** Address the invite was addressed to, and the one the email goes to. */
		email: string;
		/** Absolute URL that accepts the invite. */
		url: string;
		/** Language the copy is produced in, recorded beside the translator it came from. */
		locale: string;
		/** Translator already bound to {@link locale} by the sender. */
		t: TFunction;
	}
}

/**
 * Invitation to join a team, addressed to the invitee it names. The translator arrives
 * through the constructor because choosing the reader's language is the application's
 * own decision, made independently of the requester's language.
 *
 * @example ctx.email.later(new TeamInviteEmail({ team, email, url, locale, t }));
 */
export class TeamInviteEmail implements Email {
	/** The invite this email was built from; rendering reads only from here. */
	#invite: TeamInviteEmail.Data;

	/**
	 * Creates the email.
	 *
	 * @param invite - The invite's data, its language, and the translator for it.
	 */
	constructor(invite: TeamInviteEmail.Data) {
		this.#invite = invite;
	}

	/** The invited address, taken from the same record the copy is written from. */
	get to(): Address {
		return { email: this.#invite.email };
	}

	/** Subject naming the team, in the language the email was constructed for. */
	get subject(): string {
		return this.#invite.t("emails.teamInvite.subject", { team: this.#invite.team });
	}

	/**
	 * Body tree the mailer renders into both parts. The accept link is a real anchor
	 * so it survives into the plain-text alternative.
	 */
	body(): RemixElement {
		let { t, locale, team, url } = this.#invite;

		return (
			<Email.Layout
				lang={locale}
				title={t("emails.teamInvite.heading", { team })}
				preview={t("emails.teamInvite.preview", { team })}
			>
				<Email.Heading>{t("emails.teamInvite.heading", { team })}</Email.Heading>
				<Email.Text>{t("emails.teamInvite.body", { team })}</Email.Text>
				<Email.Button href={url}>{t("emails.teamInvite.action")}</Email.Button>
				<Email.Footer>{t("emails.teamInvite.footer")}</Email.Footer>
			</Email.Layout>
		);
	}
}
