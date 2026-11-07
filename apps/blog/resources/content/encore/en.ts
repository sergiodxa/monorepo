/**
 * Encore's pages in English. Card titles and prompts, hints and labels are the app's own
 * strings, so the page shows exactly what a player reads on the card.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EncoreCopy, EncorePagesCopy } from "~/resources/content/encore/copy";

/** The landing, header and footer in English. */
export const EN: EncoreCopy = {
	locale: "en",
	badge: "en-us",
	languageName: "English",
	meta: {
		title: "Encore: a music party game for iPhone, iPad, Apple Watch and Mac",
		description:
			"Draw a card, reveal a singing challenge and sing a song that fits it. 108 hand-written challenges in English, Spanish and Japanese, for US$4.99 once.",
	},
	header: { support: "Support", privacy: "Privacy", navLabel: "Encore" },
	footer: {
		tagline: "A familiar song. A shared moment.",
		columns: { encore: "Encore", more: "More from Sergio", elsewhere: "Elsewhere" },
		download: "Download",
		blog: "Blog",
		madeBy: "Made by",
		languages: "Language",
	},
	appStore: "Download on the App Store",
	hero: {
		eyebrow: "A music party game for iPhone, iPad, Apple Watch and Mac",
		title: "Your next night starts with a song.",
		description:
			"Draw a card, reveal the challenge, and sing a song that fits it. Encore deals 108 hand-written challenges, from guilty pleasures to duets with a stranger, and steers away from whatever you just sang.",
		tour: "How a round works",
		note: "US$4.99, once. No subscription, no ads, every card included.",
	},
	tour: {
		eyebrow: "How a round works",
		title: "Draw a card. Make it a sing-along.",
		description:
			"The card is the whole game: no menus, no players to add, no score to keep. Tap, sing, swipe.",
		stageLabel: "The four moves of a round",
		steps: [
			{
				title: "Tap to reveal",
				body: "A face-down card waits in the middle of the table. Tap it and it flips over.",
			},
			{
				title: "Sing the challenge",
				body: "Read it out loud and pick a song that fits. Whoever has one first takes the mic.",
			},
			{
				title: "Swipe when you're done",
				body: "Flick the card away and the next challenge is already face up behind it.",
			},
			{
				title: "Shake to shuffle",
				body: "Shake the phone for a fresh deck, face down again. With a keyboard, press Command-R.",
			},
		],
	},
	deck: {
		eyebrow: "The deck",
		title: "108 challenges, written by hand",
		description:
			"Every card asks for a song only your group can choose: one about you, one about the room, one about the title. Encore mixes them so the same mood never comes up twice in a row, and a shake deals a fresh deck whenever you want one.",
		listLabel: "Cards from the deck",
		generated: "Combined challenge",
	},
	cards: {
		a001: {
			title: "GUILTY PLEASURE",
			prompt: "Sing a song you're slightly embarrassed to admit you love.",
		},
		a002: {
			title: "MAIN CHARACTER",
			prompt: "Sing the song that would play during your big scene if your life were a movie.",
		},
		a060: {
			title: "DUET WITH A STRANGER",
			prompt: "Pick someone you've never sung with before. Sing a duet together—right now.",
		},
		a100: {
			title: "ENCORE",
			prompt: "You earned it. Sing whatever you want. No rules, no restrictions.",
		},
		generated: { prompt: "Sing a nostalgic song from the 1990s." },
	},
	watch: {
		eyebrow: "Apple Watch",
		title: "Run the night from your wrist",
		description:
			"Leave the phone on the table where everyone can read it. The Watch shows the card and reveals, deals or shuffles it on the iPhone.",
		items: [
			"“Card ready”, then the challenge itself, on your wrist",
			"Reveal, Next and Shuffle, with a tap you can feel",
			"Pairs with your iPhone on its own: nothing to sign in to",
			"A remote for the game on your iPhone, which stays open nearby",
		],
	},
	details: {
		eyebrow: "The small things",
		title: "Made for the room you're in",
		description:
			"Encore fits the screen you have, speaks your language and stays quiet until you ask it not to.",
		items: {
			mac: {
				title: "On a Mac",
				body: "The iPad app runs on Apple silicon Macs too, and with a keyboard Command-R shuffles the deck.",
			},
			ipad: {
				title: "On an iPad",
				body: "Any orientation, so the iPad can stand in the middle of the table.",
			},
			languages: {
				title: "In your language",
				body: "Every card, written for English, Spanish, Argentine Spanish and Japanese.",
			},
			undo: {
				title: "Swiped too soon?",
				body: "Undo brings the last card back, until the next shuffle.",
			},
			feedback: {
				title: "Sound and haptics",
				body: "Off until you turn them on in Settings. Sounds stay silent when your phone is.",
			},
			access: {
				title: "For everyone at the table",
				body: "VoiceOver reads every card aloud, and Reduce Motion fades it instead of flipping.",
			},
		},
		app: {
			game: "Game",
			shuffleDeck: "Shuffle Deck",
			previousCard: "Previous Card",
			feedback: "Feedback",
			haptics: "Haptics",
			sounds: "Sound Effects",
			faceDown: "Face-down card. Tap to reveal.",
		},
	},
	privacy: {
		eyebrow: "Privacy",
		title: "Nobody's listening",
		description:
			"Encore never opens the microphone. Your singing stays in the room, and the game keeps nothing about it.",
		checks: [
			"No account, no sign-in",
			"No microphone, recording or speech recognition",
			"No ads, analytics or tracking",
			"Every card is in the app and works offline",
			"Your iPhone and Apple Watch talk to each other, and to nobody else",
		],
		policy: "Read the privacy policy",
	},
	faq: {
		eyebrow: "Questions",
		title: "Before the first song",
		columns: [
			[
				[
					"Does Encore play the music?",
					"No. Encore deals the challenge and you bring the song: a karaoke track, a speaker, a guitar, or nothing but your voice.",
				],
				[
					"How many people can play?",
					"As many as can read one screen. There are no players to set up, no turns and no score, so anyone can take a card.",
				],
				[
					"Do I need an internet connection?",
					"No. Every card is built into the app, so it plays the same on a train, at a cabin or in a basement.",
				],
				[
					"Is Encore OK for kids?",
					"Yes. It's rated 4+ on the App Store, and every card simply asks for a song.",
				],
				[
					"Will we see the same cards again?",
					"Not until all 108 hand-written cards have come up. After that a handful of combined challenges bridge to a fresh pass, and a shake shuffles a new deck at any time.",
				],
			],
			[
				[
					"Which languages does it speak?",
					"English, Spanish, Argentine Spanish and Japanese. Encore follows your device's language.",
				],
				[
					"Does the Apple Watch work on its own?",
					"It's a remote for the game on your iPhone: it shows the card and reveals, deals and shuffles it while Encore is open on the iPhone nearby.",
				],
				[
					"How much does it cost?",
					"US$4.99 once on the App Store, or the equivalent where you live. No subscription, no in-app purchases and no ads.",
				],
				[
					"Can my family share one purchase?",
					"Yes. Encore supports Family Sharing, so everyone in your family group can download it from one purchase.",
				],
				[
					"Can I turn on sounds or vibration?",
					"Yes. Both are off at first; switch them on in the Settings app under Encore.",
				],
			],
		],
	},
	closing: {
		title: "Keep the songs coming.",
		description: "Bring everyone together: a familiar song, a shared moment.",
		support: "Need help? Visit support",
	},
	screens: {
		"card-back": "A face-down card with the hint “Tap to reveal”",
		challenge: "A revealed hand-written challenge",
		swipe: "A card swiped aside, with the next challenge behind it",
		shuffle: "A fresh face-down card after a shake, the deck fanned out",
		generated: "A combined challenge with no title",
		"watch-ready": "Apple Watch showing “Card ready” with Reveal and Shuffle",
		"watch-challenge": "Apple Watch showing a challenge with Next and Shuffle",
	},
	placeholder: "Screenshot to come",
};

/** The privacy and support pages in English. */
export const EN_PAGES: EncorePagesCopy = {
	privacy: {
		forLine: "For Encore on iPhone, iPad, Apple Watch and Mac.",
		viewMarkdown: "View as Markdown",
	},
	support: {
		title: "Encore Support",
		description:
			"Get help with Encore: Music Party Game for iPhone, iPad, Apple Watch, and Mac. Report a problem, ask a question, or suggest a feature.",
		intro: [
			"Have a question, found a bug, or have an idea for Encore? Use the form below to get in touch.",
			"If something isn’t working, tell us which device you’re using, what happened, and what you expected. Include the steps to reproduce the problem and your OS and app versions if you know them.",
		],
		formTitle: "Support form",
		sent: "Your support request has been sent. We’ll reply to the email address you provided.",
		sendAnother: "Send another request",
		failed: "We couldn’t send your request. Your message has been preserved—please try again.",
		rateLimited:
			"You’ve sent several requests in a short time. Your message has been preserved—please wait a minute and try again.",
		resubmit:
			"This form expired before it was sent. Your message has been preserved—please send it again.",
		invalid: "Please correct the highlighted fields and send your request again.",
		name: "Name (optional)",
		email: "Email",
		topic: "Topic",
		chooseTopic: "Choose a topic",
		device: "Device/platform",
		chooseDevice: "Choose a device",
		osVersion: "OS version (optional)",
		osPlaceholder: "e.g. iOS 26.1",
		appVersion: "App version (optional)",
		appPlaceholder: "e.g. 1.2",
		message: "Message",
		messagePlaceholder: "Describe your question, problem, or suggestion…",
		notice:
			"We’ll use the information you submit to respond to your request and investigate any reported issue. Please don’t include passwords, payment details, or other sensitive information. Read our",
		privacyLink: "Privacy Policy",
		submit: "Send support request",
		pending: "Sending…",
		topics: {
			"Bug report": "Bug report",
			Question: "Question",
			"Feature request": "Feature request",
			Other: "Other",
		},
		platforms: {
			iPhone: "iPhone",
			iPad: "iPad",
			"Apple Watch": "Apple Watch",
			Mac: "Mac",
			Other: "Other",
		},
	},
};
