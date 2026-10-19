/**
 * The notification as the email channel sends it: the same count and the same feed titles a
 * push carries, to the address a completed sign-in wrote, with a one-click way out of the
 * channel that a mailbox provider draws its unsubscribe button from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEmail, Email } from "@sdxc/mail";

import emails from "~/app/emails";
import { textFrom } from "~/app/services/notification-text";

export default createEmail(emails.notification, {
	subject: ({ t, ...summary }) => textFrom(t, summary).title,
	/** The signed link a provider's button posts to; absent where no link could be signed. */
	unsubscribe: ({ unsubscribeUrl }) =>
		unsubscribeUrl === null ? undefined : { url: unsubscribeUrl },
	/** The channel as a list, named under the host the link points at, for filters and feedback loops. */
	list: ({ url, t }) => ({
		id: `notifications.${new URL(url).hostname}`,
		name: t("notifications.email.listName"),
	}),
	body: (handle) => () => {
		let { t, locale, url, unsubscribeUrl, ...summary } = handle.props;
		let text = textFrom(t, summary);

		return (
			<Email.Layout lang={locale} preview={text.title} title={text.title}>
				<Email.Heading>{text.title}</Email.Heading>
				<Email.Text>{text.body}</Email.Text>
				<Email.Button href={url}>{text.title}</Email.Button>
				<Email.Footer>
					{t("notifications.email.footer")}
					{unsubscribeUrl === null ? null : (
						<>
							{" "}
							<Email.Link href={unsubscribeUrl}>{t("notifications.email.unsubscribe")}</Email.Link>
						</>
					)}
				</Email.Footer>
			</Email.Layout>
		);
	},
	preview: () => ({
		posts: 3,
		feeds: 2,
		titles: ["Example Weekly", "Another Blog"],
		url: "https://reader.example.com/reading",
		unsubscribeUrl: "https://reader.example.com/notifications/unsubscribe/preview",
	}),
});
