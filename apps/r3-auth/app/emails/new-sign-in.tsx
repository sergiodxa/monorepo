/**
 * The notice a subject receives when a session is opened on their account: which browser,
 * which system, which kind of device, the address it came from, and a link to the page
 * that can end it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEmail, Email } from "@sdxc/mail";

import type { DeviceType } from "~/app/http/view-models/account-session";

import emails from "~/app/emails";
import { ACTION_BACKGROUND, EmailLayout } from "~/app/emails/layout";
import { ISSUER_HOST } from "~/config/oidc";
import routes from "~/routes/web";

/**
 * Locale key holding the word a device class is reported with. Each class is written out
 * literally so every key the message can ask for is greppable in the catalog, and the
 * function is total over the union so every class has a name.
 */
function deviceLabelKey(deviceType: DeviceType) {
	if (deviceType === "desktop") return "emails.newSignIn.devices.desktop";
	if (deviceType === "mobile") return "emails.newSignIn.devices.mobile";
	if (deviceType === "tablet") return "emails.newSignIn.devices.tablet";
	return "emails.newSignIn.devices.unknown";
}

/**
 * Absolute URL of the account area's device list, where the notice sends a reader who
 * wants to end the session. Built from the typed route so it tracks the route table, and
 * against the published issuer host because mail needs an absolute href.
 */
function sessionsUrl(): string {
	return new URL(routes.account.sessions.index.href(), ISSUER_HOST).toString();
}

/**
 * Tells a subject that somebody signed in as them, and where to look when the sign-in is
 * unfamiliar. The facts sit in a table so a reader checking whether this was them has one
 * column to scan, and a missing address keeps its row, so the absence reads as a fact.
 */
export default createEmail(emails.newSignIn, {
	subject: ({ t }) => t("emails.newSignIn.subject"),
	body: (handle) => () => {
		let { t, locale, browser, os, deviceType, ip } = handle.props;

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
	},
	preview: () => ({ browser: "Firefox", os: "macOS", deviceType: "desktop", ip: "203.0.113.7" }),
});
