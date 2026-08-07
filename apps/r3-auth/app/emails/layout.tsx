/**
 * The shell every message this server sends is written inside: the layout kit's card
 * with this app's type stack, its action colour, and the one footer line that says why
 * the mail arrived and that nobody reads replies to the sender.
 *
 * It exists so the messages are consistent rather than each inventing their own frame.
 * Everything a security notice can differ in — heading, copy, facts, the one action — is
 * a child; everything that must not differ is here. A reader who has seen one of these
 * recognizes the next one, which for mail about somebody's account is the difference
 * between a notice they act on and a notice they report as phishing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@pkg/i18n";
import type { Handle, RemixNode } from "remix/ui";

import { Email } from "@pkg/mail";

/**
 * Fill behind an action button, as the literal a mail client keeps.
 *
 * The web pages' `--ui-color-brand-600` resolved to sRGB: it is an OKLCH custom property
 * in `resources/styles.ts`, and Gmail drops both the custom property and the stylesheet
 * that defines it, which leaves a button with no fill rather than with a fallback.
 */
export const ACTION_BACKGROUND = "#0069ca";

/**
 * Type stack the copy is set in, leading with the face the web pages use and falling
 * back through the platform UI faces. No `@font-face`: Gmail, Yahoo and Outlook on
 * Windows ignore it, so most readers see the fallback either way and shipping the web
 * font would only cost the reader a download they mostly cannot use.
 */
const FONT_FAMILY = 'Inter, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export namespace EmailLayout {
	/** Props accepted by {@link EmailLayout}. */
	export interface Props {
		/** Language the copy was produced in, written to the document. */
		lang: string;
		/** Document title, and what a client shows when it has no better name for the mail. */
		title: string;
		/** Inbox preheader: the sentence shown beside the subject in a list. */
		preview: string;
		/** Translator already bound to {@link lang} by whoever constructed the message. */
		t: TFunction;
		/** The message's own content, between the card's edges and the footer. */
		children?: RemixNode;
	}
}

/**
 * Wraps a message's content in this server's card.
 *
 * The footer is appended here rather than passed in, because it is the same two
 * sentences in every message: what this address is, and that the mail is automated. A
 * message that wanted a different footer would be a message that is not a security
 * notice, and it should not use this layout.
 */
export function EmailLayout(handle: Handle<EmailLayout.Props>) {
	return () => {
		let { lang, title, preview, t, children } = handle.props;

		return (
			<Email.Layout lang={lang} title={title} preview={preview} fontFamily={FONT_FAMILY}>
				{children}
				<Email.Footer>{t("emails.footer")}</Email.Footer>
			</Email.Layout>
		);
	};
}
