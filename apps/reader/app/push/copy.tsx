/**
 * The sentence a notification is read as, written where there is no request to detect a
 * language from. A device records the language it was registered in, so an alarm writes in
 * the language that browser was reading the app in rather than in one fixed tongue.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction, Translation } from "@sdxc/i18n";
import type { Email as EmailContract } from "@sdxc/mail";
import type { Handle } from "remix/ui";

import { createTranslator } from "@sdxc/i18n";
import { Email } from "@sdxc/mail";

import type { Summary } from "~/database/notify";

import en from "~/app/locales/en";
import es from "~/app/locales/es";

/** Every language the app ships a full dictionary for. */
const SUPPORTED_LANGUAGES = ["en", "es"];

const DEFAULT_LANGUAGE = "en";

/**
 * The translator every notification is written through. Instances are cached per language,
 * so a reader with four devices in two languages builds two and reuses them.
 */
const translator = createTranslator({
	resources: { en: { translation: en }, es: { translation: es } },
	supportedLanguages: SUPPORTED_LANGUAGES,
	fallbackLanguage: DEFAULT_LANGUAGE,
	i18next: { interpolation: { escapeValue: false } },
});

/** The two lines a notification is drawn as, on a lock screen and in an inbox alike. */
export interface NotificationText {
	title: string;
	body: string;
}

/**
 * How the summary reads in one language: a count, and up to three publishers by name. No
 * post title, no post URL and no author — a feed title is a publication the reader already
 * chose out of a list, and a post title is what they are reading right now.
 *
 * @param t - A translator already fixed to a language.
 * @param summary - What the check found since the last notification.
 * @example let { title, body } = textFrom(t, summary);
 */
export function textFrom(t: TFunction, summary: Summary): NotificationText {
	return {
		title: t("notifications.title", { count: summary.posts }),
		body: t("notifications.body", {
			count: summary.feeds,
			feeds: summary.titles.join(", "),
		}),
	};
}

/**
 * The translator for one device's language, already resolved. A language the app ships no
 * dictionary for settles on English rather than rendering keys.
 *
 * @param locale - The language the device was registered in.
 */
export async function translationFor(locale: string): Promise<Translation> {
	return await translator(locale);
}

/** The body of the email channel's message, which carries the same summary the push does. */
function NotificationBody(handle: Handle<{ text: NotificationText; url: string; footer: string }>) {
	return () => {
		let { text, url, footer } = handle.props;

		return (
			<Email.Layout preview={text.title} title={text.title}>
				<Email.Heading>{text.title}</Email.Heading>
				<Email.Text>{text.body}</Email.Text>
				<Email.Button href={url}>{text.title}</Email.Button>
				<Email.Footer>{footer}</Email.Footer>
			</Email.Layout>
		);
	};
}

/**
 * The notification as the email channel sends it: the same count and the same feed titles,
 * to the address a completed sign-in wrote.
 */
export class NotificationEmail implements EmailContract {
	/**
	 * @param address - Where the message is sent, as sign-in recorded it.
	 * @param text - The two lines the summary reads as, already in the reader's language.
	 * @param url - Where the message points, which is the reader's own queue.
	 * @param footer - Why this message arrived, which is what makes it answerable.
	 */
	constructor(
		private address: string,
		private text: NotificationText,
		private url: string,
		private footer: string,
	) {}

	/** The reader this object belongs to, which is the only recipient there ever is. */
	get to() {
		return { email: this.address };
	}

	/** The subject line, which is the count the notification exists to report. */
	get subject() {
		return this.text.title;
	}

	/** The rendered message, in both the HTML and the plain-text parts the mailer derives. */
	body() {
		return <NotificationBody text={this.text} url={this.url} footer={this.footer} />;
	}
}
