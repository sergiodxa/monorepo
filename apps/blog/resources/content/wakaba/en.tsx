/**
 * Wakaba's landing in English: every heading, sentence and alt text the English page prints,
 * in the order the bands appear. The figures come from the app: its vocabulary, sentences,
 * levels, reminder hours and widget sizes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { AccentText } from "@sdxc/ui/landing";

import type { WakabaCopy } from "~/resources/content/wakaba/copy";

/** The English page. */
export const EN: WakabaCopy = {
	locale: "en",
	captures: "en",
	meta: {
		title: "Wakaba: Japanese vocabulary for iPhone and iPad",
		description:
			"Practise Japanese vocabulary a few minutes a day with flashcards, a ten-level path and four companions, while a bonsai grows with every day you practise. Free, with no ads, subscriptions or in-app purchases.",
		socialCard: "branding/social-card.png",
		socialCardAlt: "Wakaba: Grow with every session. A vermilion bonsai beside the 学 logo.",
	},
	switchLanguage: { label: "Español", locale: "es-AR" },
	header: { support: "Support", privacy: "Privacy", navLabel: "Wakaba" },
	footer: {
		tagline: "Grow with every session. Japanese vocabulary practice for iPhone and iPad, for free.",
		columns: { wakaba: "Wakaba", more: "More from Sergio", elsewhere: "Elsewhere" },
		download: "Download",
		blog: "Blog",
		madeBy: "Made by",
	},
	appStore: { soon: "Coming soon to the", available: "Download on the" },
	hero: {
		eyebrow: "Japanese vocabulary for iPhone and iPad",
		title: (
			<>
				Grow with every <AccentText variant="color">session</AccentText>.
			</>
		),
		description: (
			<>
				For learners who know some grammar and want the words to stick: more than{" "}
				<strong>1,190 words and 2,100 sentences</strong> to read, hear, write and say, a few minutes
				at a time.
			</>
		),
		watch: "Watch the tree grow",
		note: "Free. No ads, subscriptions or in-app purchases. In English and Spanish.",
		pause: "Pause the floating cards",
		streak: { title: "23-day streak", detail: "Practised today · 36 words" },
		word: { label: "Word of the day", reading: "ki · machine" },
	},
	path: {
		eyebrow: "The learning path",
		title: "Ten levels, a few minutes at a time",
		description: (
			<>
				Each session is short and the path always shows the next one.{" "}
				<strong>Kanji and katakana arrive gradually</strong>, as you're ready for them.
			</>
		),
		stageLabel: "How a word moves along the learning path",
		steps: [
			{
				title: "Meet the word",
				body: "A new word is introduced, read aloud and shown in every spelling before anything asks you for it.",
			},
			{
				title: "Practise it in short sessions",
				body: "Meaning, reading, writing and listening, with speaking if you turn it on.",
			},
			{
				title: "Pass the level exam",
				body: "Each of the ten levels ends with an exam before the next one opens.",
			},
			{
				title: "Review what slipped",
				body: "Spaced repetition brings words back, and Aka Oni offers a review of earlier mistakes.",
			},
		],
	},
	companions: {
		eyebrow: "Companions",
		title: "Four friends, one job each",
		description:
			"Four characters from Japanese folklore keep you company, and each one turns up for a reason.",
		roles: {
			kitsune: {
				title: "The guide",
				body: "Points you to the recommended session on the path, studies alongside you and cheers a right answer.",
				alt: "Kitsune, a fox in a red scarf, pointing the way.",
			},
			oni: {
				title: "The corrector",
				body: "Turns up after a wrong answer to explain the right one, and offers a review of earlier mistakes.",
				alt: "Aka Oni, a red oni, holding up a card marked with a cross.",
			},
			tanuki: {
				title: "The cheerleader",
				body: "Applauds the effort, celebrates a finished session and offers listening practice with words you know.",
				alt: "Tanuki in a straw hat, clapping.",
			},
			tengu: {
				title: "The teacher",
				body: "Introduces new activities and offers kana practice from the path, reading and tracing.",
				alt: "Tengu, a red-faced teacher in a robe, holding a page.",
			},
		},
	},
	flashcards: {
		eyebrow: "Flashcards",
		title: "Every way to write a word, on one card",
		description: (
			<>
				Swipe through the deck in your own time. <strong>Flip a card</strong> for its details and,
				for a verb, its conjugations.
			</>
		),
		items: [
			"Kanji with furigana, hiragana, katakana and romaji",
			"The meaning in English or Spanish",
			"Pronounced by your device's own Japanese voices",
		],
	},
	exercises: {
		eyebrow: "Practice",
		title: "One word, asked five ways",
		description: (
			<>
				A session mixes the questions, so you recognise a word, recall it, hear it and use it in a
				sentence. <strong>Mistakes come back</strong> until they stop being mistakes.
			</>
		),
		listLabel: "Wakaba's exercises",
		items: [
			{
				title: "Listen and choose",
				body: "Hear the word in a Japanese voice and pick its meaning.",
			},
			{ title: "Say it aloud", body: "Optional, and recognised on your device itself." },
			{ title: "Build the sentence", body: "Put a real sentence back together from its words." },
			{ title: "Conjugate the verb", body: "Turn たべる into the form the question asks for." },
			{
				title: "Learn from a mistake",
				body: "Aka Oni shows the right answer and what set it apart.",
			},
		],
	},
	writing: {
		eyebrow: "Writing",
		title: "Trace kana with Apple Pencil",
		description: (
			<>
				Write hiragana and katakana with a finger on iPhone or with Apple Pencil on iPad.{" "}
				<strong>Each stroke is checked against its stroke order</strong> as you draw.
			</>
		),
		items: [
			"Animated stroke order for every kana and kanji",
			"Hiragana and katakana tables to look things up",
		],
	},
	details: {
		eyebrow: "The small things",
		title: "Everything else in your pocket",
		description: "The references and details you reach for between sessions.",
		items: {
			"kanji-index": {
				title: "Kanji by stroke count",
				body: "Every kanji in the reference, grouped by its strokes, with the words that use it.",
				alt: "The kanji reference, grouped by stroke count: 一, 丁, 七 and the words that use each one.",
			},
			particle: {
				title: "Particles, explained",
				body: "は, が, を and the rest: what each one does, with example sentences.",
				alt: "The particle は, the topic marker, explained with two example sentences.",
			},
			phrases: {
				title: "More than 2,100 sentences",
				body: "Real sentences for the words you learn, with the translation in your language.",
				alt: "The phrases library: 2,134 sentences such as 水を下さい。, Water, please.",
			},
			"practice-reminder": {
				title: "One quiet reminder",
				body: "Once a day at the hour you pick, morning, noon, afternoon or evening. Or never.",
				alt: "A notification on the Lock Screen: “A little Japanese today? Take a few minutes to practice your vocabulary.”",
			},
			languages: {
				title: "In English or Spanish",
				body: "Meanings and every screen in either language, and each language keeps its own progress.",
				alt: "The flashcard for 水 in Spanish: agua, mizu.",
			},
			"add-word": {
				title: "Your own words",
				body: "Add a word you met elsewhere and choose the level where practice introduces it.",
				alt: "The Add word form: meaning in English and Spanish, Japanese spellings and the learning level.",
			},
		},
	},
	bonsai: {
		eyebrow: "The bonsai",
		title: "A tree that only grows",
		description: (
			<>
				It grows with the days you practise, not with your streak, through ten stages from the first
				session to a year. <strong>Missing a day never shrinks the tree.</strong>
			</>
		),
		pause: "Pause the growing bonsai",
		grownAlt: "Wakaba's bonsai at a year of practice, fully grown, in the same pot it started in.",
		timeline:
			"Practised days, from the first session to a year. Several sessions on one day count once.",
		weekend: {
			title: "Skip the weekend, keep the tree.",
			body: "The streak counts days in a row and starts over after a gap. The bonsai counts every day you practised, so a busy weekend costs you the streak and nothing else.",
			days: ["Friday", "Monday"],
			rows: { day: "Day", streak: "Streak", practised: "Practised days", bonsai: "Bonsai" },
			streaks: ["23 days", "1 day"],
			stage: "30-day tree",
		},
	},
	widgets: {
		eyebrow: "Widgets",
		title: "Practice, one glance away",
		description:
			"Put the bonsai and a word on your Home Screen. Tap the word to open its flashcard.",
		progress: {
			title: "Practice bonsai",
			sizes: "Small and medium",
			body: "Your tree, the streak, whether you practised today and the words you've learned.",
		},
		word: {
			title: "Word of the day",
			sizes: "Small, medium and large",
			body: "Its Japanese spelling, its reading, the meaning and the romaji. Tap it for the flashcard.",
		},
	},
	privacy: {
		eyebrow: "Privacy",
		title: "Your practice stays yours",
		description:
			"No account and nothing to sign in to. Wakaba keeps your practice on your device and your progress in your own iCloud.",
		checks: [
			"No ads, analytics or tracking",
			"Practice runs on your iPhone or iPad",
			"Progress syncs through your private iCloud",
			"Speaking practice is recognised on the device",
		],
	},
	faq: {
		eyebrow: "Questions",
		title: "Before you download",
		columns: [
			[
				[
					"Who is Wakaba for?",
					"People who already know some Japanese grammar and want to remember words, recognise them when they hear them and use them in context. It doesn't teach the whole language from scratch.",
				],
				[
					"How much does it cost?",
					"Nothing. Wakaba is free, with no ads, subscriptions or in-app purchases.",
				],
				[
					"Which devices does it run on?",
					"iPhone and iPad with iOS or iPadOS 17 or later. Your progress follows you between them through iCloud.",
				],
			],
			[
				[
					"Which languages does it speak?",
					"The app and every translation come in English and Spanish.",
				],
				[
					"What happens if I miss a day?",
					"Your streak starts over the next time you practise. The bonsai counts every day you've practised, so it stays exactly as it was.",
				],
				[
					"Can I add my own words?",
					"Yes. Add words to your library, edit any entry, and choose the level where practice introduces them.",
				],
			],
		],
	},
	closing: {
		title: "Plant the tree with one session",
		description: "Wakaba is free on iPhone and iPad, in English and Spanish.",
		support: "Questions? Write to support",
	},
	screens: {
		"path-kitsune":
			"Wakaba's learning path at Level 1: numbered session stones, with Kitsune pointing to the next one.",
		"flashcards-fish":
			"A flashcard for 魚, fish: furigana さかな above the kanji and the romaji sakana below.",
		practice:
			"A practice question asking for the meaning of みず, with Aka Oni beside the word and three answers below.",
		"flashcards-water":
			"A flashcard for 水, water: furigana みず over the kanji, the meaning and the romaji mizu.",
		conjugations:
			"The details of 食べる, to eat: its dictionary form and conjugations such as 食べます and 食べません.",
		"level-exam-path":
			"The learning path reaching the Level 2 exam, with Kitsune beside the next sessions.",
		listening:
			"A listening question: a speaker button plays the word and three meanings wait below.",
		speaking: "Speaking practice asking the learner to say みず aloud, with a microphone button.",
		"build-sentence":
			"A sentence to build in Japanese from word tiles, for “I ask the teacher a question.”",
		"conjugation-practice":
			"A conjugation question: write たべる, to eat, in its polite non-past form.",
		"oni-correction":
			"Aka Oni after a wrong answer: the right word みず, water, and a note on how it differs.",
		"kana-tracing":
			"Katakana tracing practice: a stroke drawn over the guide, numbered in stroke order.",
		"stroke-guide": "The stroke-order guide for 水, its second stroke highlighted and numbered.",
		"new-word":
			"A new word introduced before any question: みず, water, mizu, with Tengu and a Start exercise button.",
		"practice-feedback":
			"A correct answer: “You got it!” over みず, water, mizu, with a Next word button.",
		"oni-mistakes":
			"A review of earlier mistakes with Aka Oni, asking for the reading of みず in romaji.",
		"widget-progress":
			"The Practice bonsai widget in the iOS widget gallery: a bonsai, a 23-day streak, 36 words learned and “Practiced today”.",
		"widget-word":
			"The Word of the day widget in the iOS widget gallery: 機, ki, machine (kanji component).",
	},
};
