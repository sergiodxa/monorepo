/**
 * The now page in English: work, what the author is building and writing, and the open
 * source he keeps up, plus the copy around them. The page and `/now.md` both read this
 * document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { NowPage } from "~/app/services/now-page";

import { NOW_LINKS, NOW_UPDATED_AT } from "~/resources/content/now/shared";

/** The page an English-speaking reader sees. */
const EN: NowPage = {
	locale: "en",
	title: "Now",
	description: "What Sergio Xalambrí is focused on at this point in his life.",
	heading: "What I’m doing now",
	intro:
		"This is what has my attention these days, the update I’d give a friend I haven’t seen in a year.",
	updatedAt: NOW_UPDATED_AT,
	location: "Lima, Peru",
	otherLanguage: { locale: "es-AR", label: "Español" },
	labels: { updated: "Updated", location: "Living in", viewMarkdown: "View as Markdown" },
	sections: [
		{
			id: "work",
			title: "Work",
			items: [
				{
					title: "Daffy",
					href: NOW_LINKS.daffy,
					text: "I’m a web developer at Daffy, a donor-advised fund that helps people give to the causes they care about, building the web app at the center of the product.",
				},
			],
		},
		{
			id: "building",
			title: "Building",
			items: [
				{
					title: "Everything on Remix v3",
					href: NOW_LINKS.monorepo,
					text: "I’m rebuilding the apps I run on Remix v3 in one public monorepo: this blog, an uptime monitor, a feed reader, a multi-tenant identity provider and the site for my React Router OAuth2 Handbook.",
				},
				{
					title: "The @sdxc packages",
					href: NOW_LINKS.packages,
					text: "The small libraries those apps share, built on Web Platform APIs: authentication, jobs, mail, feeds and a growing list of standards, with guides at sdxc.dev and a command line that creates and checks apps built with them.",
				},
				{
					title: "Encore",
					href: NOW_LINKS.encore,
					text: "A music party card game for iPhone, iPad, Apple Watch and Mac: gather friends, reveal a card, and sing a song that fits the challenge.",
				},
			],
		},
		{
			id: "writing",
			title: "Writing and speaking",
			items: [
				{
					title: "The Remix Way",
					href: NOW_LINKS.remixWay,
					text: "My talk at Remix Jam 2026 in Toronto, also written up here, on building apps from small packages around shared contracts.",
				},
				{
					title: "Tutorials",
					href: NOW_LINKS.tutorials,
					text: "Step-by-step guides to what the packages make possible, most recently a command-line tool with @sdxc/cli and an MCP server for a Remix v3 app.",
				},
			],
		},
		{
			id: "open-source",
			title: "Open source",
			items: [
				{
					title: "Remix Auth and Remix Utils",
					href: NOW_LINKS.remixAuth,
					text: "Keeping both working for the Remix and React Router apps that depend on them.",
				},
				{
					title: "Remix",
					href: NOW_LINKS.remix,
					text: "Contributing to the framework and its packages as v3 takes shape.",
				},
			],
		},
	],
	explainer: {
		title: "What is this page?",
		text: "A now page says what someone is focused on at this point in their life, rather than everything they’ve done. If you have a website, you can make one too; the idea, and a directory of people who have one, is at",
		linkLabel: "nownownow.com",
		href: NOW_LINKS.nownownow,
	},
};

export default EN;
