/**
 * The shell every message this server sends is written inside: the card, this app's type
 * stack and action colour, and the one footer line saying why the mail arrived.
 *
 * Consistency is the point. Heading, copy, facts and the single action are children;
 * everything that must stay identical lives here, so a reader who has seen one of these
 * recognizes the next one — which for mail about somebody's account is the difference
 * between a notice they act on and one they report as phishing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@pkg/i18n";
import type { Handle, RemixNode } from "remix/ui";

import { Email } from "@pkg/mail";

/**
 * Fill behind an action button, as the literal a mail client keeps: the web pages'
 * `--ui-color-brand-600` resolved to sRGB, because Gmail drops both the OKLCH custom
 * property and the stylesheet that defines it, so only a literal survives.
 */
export const ACTION_BACKGROUND = "#0069ca";

/**
 * Type stack the copy is set in, leading with the face the web pages use and falling back
 * through the platform UI faces. Gmail, Yahoo and Outlook on Windows serve the fallback
 * regardless, so the stack stays web-safe and sets from faces the reader already has.
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
 * Wraps a message's content in this server's card. The footer is appended here because
 * every message ends with the same two sentences — what this address is, and that the
 * mail is automated — so a message needing other wording belongs outside this layout.
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
