/**
 * The `/uses` page in English: the desk, editor, stack, apps and services the author works
 * with, each with a line on why. Entries in square brackets are still to be filled in. The
 * page and `/uses.md` both read this document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UsesPage } from "~/app/services/uses";

import { ITEMS } from "~/resources/content/uses/shared";

/** The page an English-speaking reader sees. */
const EN: UsesPage = {
	locale: "en",
	title: "Uses",
	description:
		"The hardware, editor, stack, apps and services Sergio Xalambrí builds for the web with.",
	intro:
		"What I build with, day to day: the desk, the editor, the stack behind this site and the services it runs on. It changes as my work does, so it’s a snapshot rather than a recommendation.",
	updated: "October 2026",
	otherLanguage: { locale: "es-AR", label: "Español" },
	labels: {
		updated: "Last updated",
		viewMarkdown: "View as Markdown",
		contents: "On this page",
	},
	sections: [
		{
			id: "desk",
			title: "Desk",
			items: [
				{ name: "[Computer]", note: "[Model and why it’s the one I work on]" },
				{ name: "[Display]", note: "[Model and setup]" },
				{ name: "[Keyboard]", note: "[Model and layout]" },
				{ name: "[Mouse or trackpad]", note: "[Model]" },
				{ name: "[Headphones and microphone]", note: "[What I use for calls and recordings]" },
			],
		},
		{
			id: "editor",
			title: "Editor and terminal",
			items: [
				{
					...ITEMS.vscode,
					note: "My one editor for code and writing, with the repository’s recommended extensions.",
				},
				{
					...ITEMS.githubTheme,
					note: "Switches between its light and dark versions with the system appearance.",
				},
				{
					...ITEMS.oxc,
					note: "Formats and lints on save with the same oxfmt and oxlint the repository checks with.",
				},
				{ name: "[Terminal]", note: "[The terminal app I run the shell in]" },
				{ ...ITEMS.zsh, note: "My shell, set up to pick the right Node.js version per project." },
				{
					...ITEMS.claudeCode,
					note: "Works in my monorepo by the rules its AGENTS.md lays out, while I review and steer.",
				},
			],
		},
		{
			id: "stack",
			title: "Stack",
			note: "What this site and the @sdxc packages are built with.",
			items: [
				{
					...ITEMS.typescript,
					note: "The language I write everything in, front end and back end.",
				},
				{
					...ITEMS.remix,
					note: "Remix v3 renders this site: its router, middleware and components, on Web APIs.",
				},
				{ ...ITEMS.bun, note: "Installs dependencies and runs every script in the monorepo." },
				{
					...ITEMS.vitePlus,
					note: "Formats, lints and type checks the whole repository in one cached pass.",
				},
				{
					...ITEMS.vitest,
					note: "Runs the tests, in Node, in a real browser and inside workerd with real bindings.",
				},
				{ ...ITEMS.msw, note: "Mocks outbound HTTP in tests, so nothing stubs fetch." },
				{
					...ITEMS.sdxc,
					note: "My own libraries for auth, jobs, mail, caching and UI, which every app here uses.",
				},
			],
		},
		{
			id: "services",
			title: "Hosting and services",
			items: [
				{
					...ITEMS.workers,
					note: "Where this site and my other apps run, close to every reader.",
				},
				{ ...ITEMS.d1, note: "The site’s database, caches and backups, next to the Worker." },
				{ ...ITEMS.github, note: "Home of all my code, from the monorepo to Remix Auth." },
				{
					...ITEMS.actions,
					note: "Checks every push and publishes the @sdxc packages in a daily release.",
				},
				{ ...ITEMS.npm, note: "Where the @sdxc packages are published." },
			],
		},
		{
			id: "apps",
			title: "Apps",
			items: [
				{ ...ITEMS.safari, note: "My main browser." },
				{ ...ITEMS.githubDesktop, note: "To review and stage changes visually before a commit." },
				{ name: "[Other apps]", note: "[Apps I use every day, and why]" },
			],
		},
	],
};

export default EN;
