/**
 * The apps showcase in English: each product the author ships, with a short pitch and where
 * to open it. The page and `/apps.md` both read this document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AppsPage } from "~/app/services/apps-page";

import { APP_LINKS } from "~/resources/content/apps/shared";

/** The page an English-speaking reader sees. */
const EN: AppsPage = {
	locale: "en",
	title: "Apps",
	description:
		"Apps Sergio Xalambrí built: Japanese vocabulary, a music party game, uptime monitoring and a feed reader.",
	heading: "Apps I built",
	accent: "built",
	eyebrow: "App Store and the web",
	intro:
		"Products I ship myself — on the App Store and on the web — each with its own home to try or download.",
	browseCta: "See the apps",
	otherLanguage: { locale: "es-AR", label: "Español" },
	labels: {
		viewMarkdown: "View as Markdown",
		stages: {
			hero: "Wakaba and Encore on iPhone",
			wakaba: "Wakaba on iPhone: learning path, flashcards and practice",
			encore: "Encore on iPhone: challenge card, card back and swipe",
		},
		pause: "Pause the animation",
	},
	apps: [
		{
			id: "wakaba",
			name: "Wakaba",
			href: APP_LINKS.wakaba,
			platform: "App Store",
			blurb:
				"Japanese vocabulary practice a few minutes a day on iPhone and iPad: flashcards, a ten-level path and four companions, while a bonsai grows with every session. Free, with no ads or in-app purchases.",
			highlights: [
				"Ten-level path with short daily sessions",
				"Flashcards, listening and speaking practice",
				"A bonsai that grows with every day you practise",
			],
			cta: "Open Wakaba",
		},
		{
			id: "encore",
			name: "Encore",
			href: APP_LINKS.encore,
			platform: "App Store",
			blurb:
				"A music party card game for iPhone, iPad, Apple Watch and Mac: reveal a card, pick a song that fits the challenge, and sing. Out now on the App Store.",
			highlights: [
				"108 hand-written singing challenges",
				"Tap to reveal, swipe for the next card",
				"Apple Watch remote for the room",
			],
			cta: "Open Encore",
		},
		{
			id: "uptime",
			name: "Uptime",
			href: APP_LINKS.uptime,
			platform: "Web",
			blurb:
				"Simple, reliable uptime monitoring for developers: websites, APIs, DNS, SSL certificates and cron jobs, with alerts and public status pages.",
			highlights: [
				"HTTP, DNS, SSL and cron in one place",
				"Alerts when a check fails",
				"Public status pages for your users",
			],
			cta: "Open Uptime",
		},
		{
			id: "reader",
			name: "Reader",
			href: APP_LINKS.reader,
			platform: "Web",
			blurb:
				"Follow any site that publishes RSS or Atom and read everything it writes in one place — your own library of feeds, folders and saved posts.",
			highlights: [
				"Any RSS or Atom feed",
				"Folders and saved posts",
				"Your library, not a timeline",
			],
			cta: "Open Reader",
		},
	],
};

export default EN;
