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
	intro:
		"Products I ship myself — on the App Store and on the web — each with its own home to try or download.",
	otherLanguage: { locale: "es-AR", label: "Español" },
	labels: { viewMarkdown: "View as Markdown" },
	apps: [
		{
			id: "wakaba",
			name: "Wakaba",
			href: APP_LINKS.wakaba,
			platform: "App Store",
			blurb:
				"Japanese vocabulary practice a few minutes a day on iPhone and iPad: flashcards, a ten-level path and four companions, while a bonsai grows with every session. Free, with no ads or in-app purchases.",
		},
		{
			id: "encore",
			name: "Encore",
			href: APP_LINKS.encore,
			platform: "App Store",
			blurb:
				"A music party card game for iPhone, iPad, Apple Watch and Mac: reveal a card, pick a song that fits the challenge, and sing. Out now on the App Store.",
		},
		{
			id: "uptime",
			name: "Uptime",
			href: APP_LINKS.uptime,
			platform: "Web",
			blurb:
				"Simple, reliable uptime monitoring for developers: websites, APIs, DNS, SSL certificates and cron jobs, with alerts and public status pages.",
		},
		{
			id: "reader",
			name: "Reader",
			href: APP_LINKS.reader,
			platform: "Web",
			blurb:
				"Follow any site that publishes RSS or Atom and read everything it writes in one place — your own library of feeds, folders and saved posts.",
		},
	],
};

export default EN;
