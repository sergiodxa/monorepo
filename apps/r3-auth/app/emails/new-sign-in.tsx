/**
 * The notice a subject receives when a session is opened on their account: which
 * browser, which system, which kind of device, and the address it came from, with a link
 * to the page that can end it.
 *
 * It is the one message this server sends that nobody asked for, which is the point — a
 * sign-in the owner did not perform is only discoverable if somebody tells them about
 * it. So it carries facts and a way to act, and no token of any kind: the session's id
 * *is* the refresh token, and the account page authenticates the reader on its own
 * before it will list anything.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@pkg/i18n";
import type { Address, Email as EmailContract } from "@pkg/mail";
import type { RemixElement } from "remix/ui";

import { Email } from "@pkg/mail";

import type { DeviceType } from "~/app/http/view-models/account-session";

import { ISSUER_HOST } from "~/app/config";
import { ACTION_BACKGROUND, EmailLayout } from "~/app/emails/layout";
import routes from "~/routes/web";

/**
 * Locale key holding the word a device class is reported with.
 *
 * Written out per class rather than interpolated, so every key the message can ask for
 * is greppable in the catalog, and total over the union so an unnamed class is
 * impossible.
 */
export function deviceLabelKey(deviceType: DeviceType): string {
	if (deviceType === "desktop") return "emails.newSignIn.devices.desktop";
	if (deviceType === "mobile") return "emails.newSignIn.devices.mobile";
	if (deviceType === "tablet") return "emails.newSignIn.devices.tablet";
	return "emails.newSignIn.devices.unknown";
}

export namespace NewSignInEmail {
	/** Everything the notice reports, all of it captured when the session was opened. */
	export interface Data {
		/** The subject's address, which is who the notice is addressed to. */
		email: string;
		/** Browser family the session was opened from, or the unknown label. */
		browser: string;
		/** Operating system family, or the unknown label. */
		os: string;
		/** Device class, so the copy names it in the reader's language. */
		deviceType: DeviceType;
		/** Address the sign-in came from; `null` when the platform recorded none. */
		ip: string | null;
		/** Language the copy is produced in, recorded beside the translator it came from. */
		locale: string;
		/** Translator already bound to {@link locale} by the sender. */
		t: TFunction;
	}
}

/**
 * Tells a subject that somebody signed in as them, and where to look if it was not them.
 *
 * @example await mailer.send(new NewSignInEmail({ email, browser, os, deviceType, ip, locale, t }));
 */
export class NewSignInEmail implements EmailContract {
	/** The sign-in this notice was built from; nothing is loaded while rendering. */
	#signIn: NewSignInEmail.Data;

	/**
	 * Creates the notice.
	 *
	 * @param signIn - The subject's address, what was recorded about the session, and the
	 *   language to write it in.
	 */
	constructor(signIn: NewSignInEmail.Data) {
		this.#signIn = signIn;
	}

	/** The subject's own address; a security notice never goes anywhere else. */
	get to(): Address {
		return { email: this.#signIn.email };
	}

	/** Subject in the language the notice was constructed for. */
	get subject(): string {
		return this.#signIn.t("emails.newSignIn.subject");
	}

	/**
	 * Body tree the mailer renders into both parts.
	 *
	 * The three facts are a table rather than three sentences, because a reader deciding
	 * whether this was them scans for the one line that looks wrong, and a table gives
	 * them a column to scan. A missing address is reported as such instead of being
	 * dropped: a row that quietly disappears reads as a shorter notice, not as a fact
	 * nobody recorded.
	 */
	body(): RemixElement {
		let { t, locale, browser, os, deviceType, ip } = this.#signIn;

		return (
			<EmailLayout
				lang={locale}
				t={t}
				title={t("emails.newSignIn.heading")}
				preview={t("emails.newSignIn.preview")}
			>
				<Email.Heading>{t("emails.newSignIn.heading")}</Email.Heading>
				<Email.Text>{t("emails.newSignIn.body")}</Email.Text>
				<Email.Table
					rows={[
						{ label: t("emails.newSignIn.facts.browser"), value: browser },
						{
							label: t("emails.newSignIn.facts.device"),
							value: `${os} · ${t(deviceLabelKey(deviceType))}`,
						},
						{
							label: t("emails.newSignIn.facts.ip"),
							value: ip ?? t("emails.newSignIn.facts.ipUnknown"),
						},
					]}
				/>
				<Email.Text>{t("emails.newSignIn.expected")}</Email.Text>
				<Email.Button href={sessionsUrl()} background={ACTION_BACKGROUND}>
					{t("emails.newSignIn.action")}
				</Email.Button>
				<Email.Text muted>{t("emails.newSignIn.unexpected")}</Email.Text>
			</EmailLayout>
		);
	}
}

/**
 * Absolute URL of the account area's device list, which is where the notice sends
 * somebody who does not recognize the sign-in.
 *
 * Built from the typed route so the path cannot drift from the route table, against the
 * published issuer host because a relative href in mail resolves against nothing. The
 * page names no session until it has authenticated the reader, so the link is safe to
 * put in an inbox in a way a link carrying a session id never would be.
 */
function sessionsUrl(): string {
	return new URL(routes.account.sessions.index.href(), ISSUER_HOST).toString();
}
