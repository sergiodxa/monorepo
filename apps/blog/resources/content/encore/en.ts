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
		socialCardAlt:
			"A face-down Encore card and the EARWORM challenge beside “Your next night starts with a song.”",
	},
	header: { support: "Support", privacy: "Privacy", navLabel: "Encore", sound: "Sound effects" },
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
		eyebrow: "The party game where every card is a song",
		title: "Your next night starts with a song.",
		description:
			"Flip a card, read the challenge, belt out a song that fits. 108 hand-written challenges, from guilty pleasures to a duet with a total stranger. Bad singers extremely welcome.",
		tour: "How to play",
		note: "US$4.99 once. No subscriptions, no ads, no judgement.",
	},
	play: {
		eyebrow: "Your turn",
		title: "Pick a card, any card",
		description:
			"Three real cards from the deck, on the house. Tap the card, read it out loud, and sing. Nobody's recording.",
		draw: "Draw another",
		shuffle: "Shuffle",
		left: "Card {count} of {total}",
		end: "The party continues in Encore, with 105 more cards waiting for you.",
	},
	tour: {
		eyebrow: "How to play",
		title: "Flip. Sing. Swipe. Repeat until hoarse.",
		description:
			"The card is the whole game. No menus, no teams to pick, no scoreboard to argue over.",
		stageLabel: "The four moves of a round",
		steps: [
			{ title: "Tap to reveal", body: "A card waits face down, all mystery. Tap it and it flips." },
			{
				title: "Sing it",
				body: "Read the challenge out loud. Whoever has a song first grabs the mic (or the hairbrush).",
			},
			{
				title: "Swipe for the next one",
				body: "Flick the card away when the song is done. The next challenge is already face up.",
			},
			{
				title: "Shake things up",
				body: "Shake the phone for a brand-new deck. With a keyboard, Command-R does it too.",
			},
		],
	},
	deck: {
		eyebrow: "The deck",
		title: "108 challenges, each one a little bit of trouble",
		description:
			"Some are about you, some about the room, some about the title of the song. Encore deals them so the same mood never comes twice in a row. Go on, tap one.",
		listLabel: "Cards from the deck",
		generated: "Combined challenge",
		reveal: "Tap to reveal",
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
		a011: {
			title: "EVERYBODY KNOWS THIS ONE",
			prompt:
				"Choose a song you believe every single person here knows. Everyone joins in on the chorus.",
		},
		a033: {
			title: "ROAD TRIP",
			prompt: "Sing a song you play loudly in a car with the windows down.",
		},
		a045: {
			title: "NEW YEAR'S EVE",
			prompt:
				"Sing a song that belongs at midnight on New Year's Eve—the kind that makes people feel something.",
		},
		a015: {
			title: "KARAOKE CHAMPION",
			prompt:
				"Sing whatever you'd choose to absolutely destroy at karaoke. Pull out all the stops.",
		},
		a080: {
			title: "HOLIDAY CLASSIC",
			prompt: "Sing a seasonal song—the one that immediately makes the room feel festive.",
		},
		a104: { title: "FOREIGN FAVOURITE", prompt: "Sing a hit from a country that isn't your own." },
		a008: { title: "SHOWER SONG", prompt: "Sing the song you actually sing in the shower." },
		a024: {
			title: "MUSICAL THEATRE",
			prompt: "Sing a song from a musical. Full theatrical commitment expected.",
		},
		a090: {
			title: "THE SLOW BUILD",
			prompt: "Sing a song that starts quietly and ends in something close to chaos.",
		},
		generated: { prompt: "Sing a nostalgic song from the 1990s." },
	},
	watch: {
		eyebrow: "Apple Watch",
		title: "Conduct the chaos from your wrist",
		description:
			"Leave the phone on the table where everyone can read it. Your Apple Watch flips, deals and shuffles from across the room.",
		items: [
			"“Card ready” on your wrist, then the challenge itself",
			"Reveal, Next and Shuffle, with a little tap you can feel",
			"Pairs with your iPhone on its own: nothing to sign in to",
			"Works while Encore is open on the iPhone nearby",
		],
	},
	details: {
		eyebrow: "Game night, anywhere",
		title: "A card for every kind of night",
		description: "Karaoke bar, road trip or New Year's Eve: there's a card for that.",
		items: {
			karaoke: {
				title: "Karaoke night",
				body: "No machine? No problem. Any speaker, any room, any level of talent.",
			},
			road: {
				title: "Road trip",
				body: "Every card lives in the app, so the game keeps going with no signal.",
			},
			holiday: {
				title: "Holiday party",
				body: "Prop an iPad in the middle of the table, or play on a Mac when everyone's on the couch.",
			},
			abroad: {
				title: "Friends from abroad",
				body: "Cards in English, Spanish and Japanese, in whatever language your phone speaks.",
			},
			newYear: {
				title: "New Year's Eve",
				body: "Shake for a fresh deck whenever the night needs one. No setup, no scores.",
			},
			everyone: {
				title: "Everyone sings",
				body: "No turns and no teams: whoever knows a song grabs the mic. VoiceOver reads every card aloud.",
			},
		},
	},
	privacy: {
		eyebrow: "Privacy",
		title: "What happens at karaoke\nstays at karaoke",
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
					"Do we need to be good singers?",
					"Absolutely not. Some cards practically beg you to be terrible: OVERACT IT wants dramatic, theatrical commitment to every word.",
				],
				[
					"Do I need an internet connection?",
					"No. Every card is built into the app, so it plays the same on a train, at a cabin or in a basement.",
				],
				[
					"What if nobody knows a song that fits?",
					"Swipe it away. No penalties, no points to lose, and the next card is already waiting face up.",
				],
				[
					"Will we see the same cards again?",
					"Not until all 108 hand-written cards have come up. After that a handful of combined challenges bridge to a fresh pass, and a shake shuffles a new deck at any time.",
				],
				[
					"What's the most dangerous card?",
					"Probably DUET WITH A STRANGER, which asks you to pick someone you've never sung with and duet right now. Consider yourself warned.",
				],
			],
			[
				[
					"How much does it cost?",
					"US$4.99 once on the App Store, or the equivalent where you live. No subscription, no in-app purchases and no ads.",
				],
				[
					"Can I play alone?",
					"Technically, yes: the shower counts. But Encore really shines with a room full of people who can't help singing along.",
				],
				[
					"Which languages does it speak?",
					"English, Spanish, Argentine Spanish and Japanese. Encore follows your device's language.",
				],
				[
					"How many people can play?",
					"As many as can read one screen. There are no players to set up, no turns and no score, so anyone can take a card.",
				],
				[
					"Does the Apple Watch work on its own?",
					"It's a remote for the game on your iPhone: it shows the card and reveals, deals and shuffles it while Encore is open on the iPhone nearby.",
				],
				[
					"Can my family share one purchase?",
					"Yes. Encore supports Family Sharing, so everyone in your family group can download it from one purchase.",
				],
			],
		],
	},
	closing: {
		title: "Keep the songs coming.",
		description: "Grab your people, claim a corner of the room, flip the first card.",
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
