/**
 * The notice a team's other members get when the team is destroyed by its owner's account
 * deletion: the team is gone, why, what went with it, and what they can do instead. It names
 * only the team; the departed owner's identity and address are being erased, so "the owner
 * deleted their account" is the whole reason a reader needs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@pkg/i18n";
import type { Address } from "@pkg/mail";
import type { RemixElement } from "remix/ui";

import { Email } from "@pkg/mail";

export namespace TeamDeletedEmail {
	/** Everything the notice needs, all of it captured before the team was deleted. */
	export interface Data {
		/** Display name of the deleted team. */
		team: string;
		/** Address of the former member this copy goes to. */
		email: string;
		/** Language the copy is produced in, recorded beside the translator it came from. */
		locale: string;
		/** Translator already bound to {@link locale} by the sender. */
		t: TFunction;
	}
}

/**
 * Tells a former member that their team is gone for good.
 *
 * Offers starting again with a team of their own as the only next step now that the deleted
 * team is gone.
 *
 * @example await mailer.send(new TeamDeletedEmail({ team, email, locale, t }));
 */
export class TeamDeletedEmail implements Email {
	/** The notice this email was built from; rendering reads only from here. */
	#notice: TeamDeletedEmail.Data;

	/**
	 * Creates the email.
	 *
	 * @param notice - The deleted team's name, the recipient, and the translator for them.
	 */
	constructor(notice: TeamDeletedEmail.Data) {
		this.#notice = notice;
	}

	/** The former member's address, resolved from their subject id before the team was deleted. */
	get to(): Address {
		return { email: this.#notice.email };
	}

	/** Subject naming the team, in the language the email was constructed for. */
	get subject(): string {
		return this.#notice.t("emails.teamDeleted.subject", { team: this.#notice.team });
	}

	/**
	 * Body tree the mailer renders into both parts, as three paragraphs — what happened, what
	 * it means, what to do — so the data-loss warning stands on its own line for a skimmer
	 * reading the plain-text alternative.
	 */
	body(): RemixElement {
		let { t, locale, team } = this.#notice;

		return (
			<Email.Layout
				lang={locale}
				title={t("emails.teamDeleted.heading", { team })}
				preview={t("emails.teamDeleted.preview", { team })}
			>
				<Email.Heading>{t("emails.teamDeleted.heading", { team })}</Email.Heading>
				<Email.Text>{t("emails.teamDeleted.body", { team })}</Email.Text>
				<Email.Text>{t("emails.teamDeleted.lost")}</Email.Text>
				<Email.Text>{t("emails.teamDeleted.next")}</Email.Text>
				<Email.Footer>{t("emails.teamDeleted.footer", { team })}</Email.Footer>
			</Email.Layout>
		);
	}
}
