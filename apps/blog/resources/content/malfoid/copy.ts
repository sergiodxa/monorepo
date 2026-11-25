/**
 * The words Malfoid Stickers' pages print: the landing's bands, the six moods, the questions,
 * and the labels of the support form. The privacy policy lives in its own Markdown file, so
 * the page and its Markdown twin read from one source.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {
	MALFOID_SUPPORT_PLATFORMS,
	MALFOID_SUPPORT_TOPICS,
} from "~/app/http/validators/malfoid-support";
import type { StickerCategory, StickerId } from "~/resources/content/malfoid/stickers";
import type { SupportForm } from "~/resources/views/app-pages/support-form";

/** How a mood is named and introduced, and the sticker that stands for it. */
export interface MoodCopy {
	name: string;
	body: string;
	cover: StickerId;
}

/** The six moods, each with its name, its one-line introduction and its cover sticker. */
export const MOODS: Record<StickerCategory, MoodCopy> = {
	"pride-and-sarcasm": {
		name: "Pride & sarcasm",
		body: "Chin up, eyes rolled, applause entirely insincere. For when you’re right and everyone should know it.",
		cover: "superior-look",
	},
	"anger-and-frustration": {
		name: "Anger & frustration",
		body: "Pouts, stomps, death stares and the occasional full tantrum. Cheaper than yelling.",
		cover: "angry-pout",
	},
	"tsundere-and-embarrassment": {
		name: "Embarrassment & tsundere",
		body: "Blushing, looking away and absolutely not caring. She’ll offer you a heart. Don’t make it weird.",
		cover: "pretending-not-to-care",
	},
	"happiness-and-affection": {
		name: "Happiness & affection",
		body: "Real smiles, sparkling eyes, hugs and blown kisses: proof the attitude is mostly for show.",
		cover: "sparkling-eyes",
	},
	"sadness-and-exhaustion": {
		name: "Sadness & exhaustion",
		body: "Dramatic tears, a tiny pout, and hiding under the blanket until further notice.",
		cover: "dramatic-crying",
	},
	"everyday-reactions": {
		name: "Everyday reactions",
		body: "Hello, goodbye, hmm, popcorn, tea. The small replies that keep a conversation going.",
		cover: "eating-popcorn",
	},
};

/** The promises the privacy band lists, each true of the app as shipped. */
export const PRIVACY_FACTS = [
	"Completely free: no ads, subscriptions or in-app purchases.",
	"No account, no sign-in, nothing to set up.",
	"No analytics, no tracking and no data collection.",
	"No access to your conversations, contacts, photos, camera, microphone or location.",
	"All 60 stickers are bundled in the app and load offline.",
] as const;

/** The steps from the App Store to the first sticker sent, in order. */
export const INSTALL_STEPS = [
	{
		title: "Get the pack",
		body: "Install Malfoid Stickers from the App Store on your iPhone or iPad.",
	},
	{
		title: "Open Messages",
		body: "Start or open any iMessage conversation.",
	},
	{
		title: "Find her",
		body: "Tap + beside the text field, then Stickers, and choose Malfoid from the packs.",
	},
	{
		title: "React",
		body: "Tap a sticker to send it, or touch and hold it, then drag it onto a message bubble.",
	},
] as const;

/** The questions a visitor asks before installing, with answers that stay within the facts. */
export const QUESTIONS: ReadonlyArray<readonly [string, string]> = [
	[
		"How much does it cost?",
		"Nothing. Malfoid Stickers is completely free, with no ads, subscriptions or in-app purchases.",
	],
	[
		"Does it collect any data?",
		"No. The app has no account, analytics or tracking, collects no data, and never accesses your conversations, contacts, photos, camera, microphone or location.",
	],
	[
		"Does it work offline?",
		"Yes. Every sticker is bundled with the app, so the pack opens without a connection. Messages still needs one to deliver what you send.",
	],
	[
		"Which languages does it support?",
		"All of them. The stickers have no text, so a pout or an eye roll means the same thing in every language.",
	],
	[
		"Does it work on iPad?",
		"Yes. Malfoid Stickers is a native iMessage sticker pack for iPhone and iPad.",
	],
	[
		"I installed it, but I can’t find it.",
		"In Messages, tap + beside the text field, then Stickers, and look for Malfoid among your packs. The support page has more troubleshooting steps.",
	],
];

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
