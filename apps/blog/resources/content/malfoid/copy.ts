/**
 * The words Malfoid Stickers' support page prints: its quick fixes and the labels of the support
 * form. The landing's words live in `landing.ts` and the privacy policy in its own Markdown file,
 * so the page and its Markdown twin read from one source.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {
	MALFOID_SUPPORT_PLATFORMS,
	MALFOID_SUPPORT_TOPICS,
} from "~/app/http/validators/malfoid-support";
import type { SupportForm } from "~/resources/views/app-pages/support-form";

/** Every label the support page and its form print. */
export interface SupportCopy extends SupportForm.Labels {
	title: string;
	description: string;
	topics: Record<(typeof MALFOID_SUPPORT_TOPICS)[number], string>;
	platforms: Record<(typeof MALFOID_SUPPORT_PLATFORMS)[number], string>;
}

/** The support page's words. */
export const SUPPORT: SupportCopy = {
	title: "Malfoid Stickers Support",
	description:
		"Get help with Malfoid Stickers, the free iMessage sticker pack for iPhone and iPad: find the stickers in Messages, fix a missing pack, or send a question.",
	formTitle: "Still stuck? Write to me",
	sent: "Your support request has been sent. I’ll reply to the email address you provided.",
	sendAnother: "Send another request",
	failed: "I couldn’t send your request. Your message has been preserved—please try again.",
	rateLimited:
		"You’ve sent several requests in a short time. Your message has been preserved—please wait a minute and try again.",
	resubmit:
		"This form expired before it was sent. Your message has been preserved—please send it again.",
	invalid: "Please correct the highlighted fields and send your request again.",
	name: "Name (optional)",
	email: "Email",
	topic: "Topic",
	chooseTopic: "Choose a topic",
	device: "Device",
	chooseDevice: "Choose a device",
	osVersion: "iOS or iPadOS version (optional)",
	osPlaceholder: "e.g. iOS 26.1",
	appVersion: "App version (optional)",
	appPlaceholder: "e.g. 1.0",
	message: "Message",
	messagePlaceholder: "Describe your question, problem, or sticker idea…",
	notice:
		"This form is part of the website, not the app. I’ll use what you submit to reply, to investigate the problem you report and to improve the pack. Please don’t include passwords, payment details, or other sensitive information. Read the",
	privacyLink: "Privacy Policy",
	submit: "Send support request",
	pending: "Sending…",
	topics: {
		"Stickers not showing": "Stickers not showing",
		"Bug report": "Bug report",
		Question: "Question",
		"Sticker idea": "Sticker idea",
		Other: "Other",
	},
	platforms: { iPhone: "iPhone", iPad: "iPad", Other: "Other" },
};

/** The troubleshooting steps the support page lists before the form, each a title and a fix. */
export const TROUBLESHOOTING: ReadonlyArray<readonly [string, string]> = [
	[
		"I can’t find the stickers in Messages",
		"Open a conversation, tap + beside the text field, then Stickers. Your sticker packs appear along the drawer; Malfoid is one of them. If you see an older layout, look for the App Store icon row above the keyboard instead.",
	],
	[
		"The pack isn’t in the list at all",
		"Make sure Malfoid Stickers is installed on this device: open the App Store, search for it and check that it shows Open rather than Get. A pack installed on your iPhone isn’t on your iPad until you install it there too.",
	],
	[
		"Stickers show a blank square or won’t load",
		"Close Messages and open it again. If that doesn’t help, restart your device. The artwork ships inside the app, so the stickers don’t need a connection to appear.",
	],
	[
		"A sticker won’t stick to a bubble",
		"Touch and hold the sticker until it lifts, then drag it onto the message and let go. A quick tap sends it as its own message instead.",
	],
	[
		"I want to remove the pack",
		"Delete Malfoid Stickers like any other app. It stores nothing about you, so there’s nothing else to clean up.",
	],
];
