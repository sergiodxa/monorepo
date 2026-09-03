/**
 * The notice a subject receives when a session is opened on their account: which browser,
 * which system, which kind of device, the address it came from, and a link to the page
 * that can end it.
 *
 * It is unsolicited by design — an owner learns of an unrecognized sign-in only because
 * something tells them. It carries facts and a way to act; the account page authenticates
 * the reader itself, keeping every credential out of the mail.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@sdxc/i18n";
import type { Address, Email as EmailContract } from "@sdxc/mail";
import type { RemixElement } from "remix/ui";

import { Email } from "@sdxc/mail";

import type { DeviceType } from "~/app/http/view-models/account-session";

import { ISSUER_HOST } from "~/app/config";
import { ACTION_BACKGROUND, EmailLayout } from "~/app/emails/layout";
import routes from "~/routes/web";

/**
 * Locale key holding the word a device class is reported with. Each class is written out
 * literally so every key the message can ask for is greppable in the catalog, and the
 * function is total over the union so every class has a name.
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
 * Tells a subject that somebody signed in as them, and where to look when the sign-in is
 * unfamiliar.
 *
 * @example await mailer.send(new NewSignInEmail({ email, browser, os, deviceType, ip, locale, t }));
 */
export class NewSignInEmail implements EmailContract {
	/** The sign-in this notice was built from; rendering reads only from here. */
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

	/** The subject's own address, the only recipient a security notice has. */
	get to(): Address {
		return { email: this.#signIn.email };
	}

	/** Subject in the language the notice was constructed for. */
	get subject(): string {
		return this.#signIn.t("emails.newSignIn.subject");
	}

	/**
	 * Body tree the mailer renders into both parts. The facts sit in a table so a reader
	 * checking whether this was them has one column to scan, and a missing address keeps its
	 * row with an explicit label, so the absence itself reads as a recorded fact.
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
 * Absolute URL of the account area's device list, where the notice sends a reader who
 * wants to end the session. Built from the typed route so it tracks the route table, and
 * against the published issuer host because mail needs an absolute href.
 */
function sessionsUrl(): string {
	return new URL(routes.account.sessions.index.href(), ISSUER_HOST).toString();
}
