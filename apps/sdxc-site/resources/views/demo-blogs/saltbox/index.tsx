/**
 * Saltbox, an invented personal blog by a backend engineer about Go, Postgres and running
 * your own servers, drawn as a classic two-column blog: masthead, nav bar, excerpts and a
 * sidebar of widgets. Its posts are the Markdown files in `posts/`, named by their slug.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DemoBlogSite } from "~/resources/views/demo-blogs";

import { SaltboxAbout } from "~/resources/views/demo-blogs/saltbox/about";
import { SaltboxPage } from "~/resources/views/demo-blogs/saltbox/pages";

/** Every post's source, keyed by its path relative to this file. */
const POST_MODULES = import.meta.glob<string>("./posts/*.md", {
	query: "?raw",
	import: "default",
});

/** A barn-paint brick red at hue 28, deep enough to carry white text on the nav and buttons. */
const BRAND = [
	"oklch(0.975 0.012 28)",
	"oklch(0.945 0.03 28)",
	"oklch(0.89 0.062 28)",
	"oklch(0.81 0.1 28)",
	"oklch(0.7 0.14 28)",
	"oklch(0.6 0.16 28)",
	"oklch(0.52 0.155 28)",
	"oklch(0.45 0.135 28)",
	"oklch(0.38 0.11 28)",
	"oklch(0.3 0.085 28)",
	"oklch(0.22 0.06 28)",
] as const;

/** Near-neutral greys with a breath of blue, so the page reads as plain white paper. */
const NEUTRAL = [
	"oklch(0.995 0.001 250)",
	"oklch(0.97 0.003 250)",
	"oklch(0.925 0.005 250)",
	"oklch(0.85 0.007 250)",
	"oklch(0.72 0.009 250)",
	"oklch(0.6 0.01 250)",
	"oklch(0.5 0.01 250)",
	"oklch(0.41 0.01 250)",
	"oklch(0.31 0.009 250)",
	"oklch(0.22 0.008 250)",
	"oklch(0.16 0.006 250)",
] as const;

/** The reading serif: the face long-form blogs of the 2010s set their posts in. */
const SERIF = "Georgia, Cambria, 'Times New Roman', Times, serif";

/** The interface sans for titles, meta lines, widgets and navigation. */
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

/** The Saltbox mark: the long, lopsided roof of a saltbox house over a lit window. */
function mark() {
	return (
		<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
			<path d="M2 21V12L9 5l13 9v7z" fill="var(--ui-brand-bg-solid)" />
			<rect x="6" y="14" width="3.5" height="3.5" fill="var(--ui-bg)" />
			<rect x="13" y="15" width="3.5" height="6" fill="var(--ui-bg)" />
		</svg>
	);
}

/**
 * The blog: five kinds in one feed, eight tags, and an author with two profiles. The kinds'
 * order is the order the nav bar, the categories widget and the filters offer them.
 */
const SALTBOX: DemoBlogSite = {
	name: "Saltbox",
	kind: "Personal blog",
	tagline: "Go, Postgres and the servers under them, by Wren Halloran.",
	artDirection: "White paper, brick red, Georgia over a system sans",
	description:
		"Articles, tutorials, notes, links and a glossary about Go, Postgres and self-hosting, by an invented backend engineer.",
	mark,
	theme: {
		brand: BRAND,
		neutral: NEUTRAL,
		tokens: {
			"--demo-blog-heading-font": SANS,
			"--demo-blog-heading-weight": "700",
			"--demo-blog-reading-font": SERIF,
			"--ui-radius-md": "0.25rem",
			"--ui-radius-lg": "0.375rem",
		},
	},
	author: {
		name: "Wren Halloran",
		role: "Backend engineer in St. John's, Newfoundland",
		initials: "WH",
		bio: "I write Go services and look after the Postgres databases under them, mostly on servers I can SSH into. Saltbox is where I keep what I learn, plainly built and meant to last a few winters.",
		links: [
			{ label: "Mastodon", href: "https://mastodon.example/@wren" },
			{ label: "GitHub", href: "https://code.example/wren" },
		],
	},
	kinds: {
		articles: {
			label: "Articles",
			singular: "Article",
			description:
				"Longer pieces on how Go services and Postgres behave once real traffic arrives.",
		},
		tutorials: {
			label: "Tutorials",
			singular: "Tutorial",
			description: "Step-by-step builds you can follow on your own server, some in series.",
		},
		notes: {
			label: "Notes",
			singular: "Note",
			description:
				"Short things I learned at work this week, small enough to read on the front page.",
			layout: "note",
		},
		links: {
			label: "Links",
			singular: "Link",
			description: "Pages elsewhere I keep going back to, each with why.",
			layout: "bookmark",
		},
		glossary: {
			label: "Glossary",
			singular: "Term",
			description: "The words backend work leans on, defined once and linked from everywhere.",
			layout: "term",
		},
	},
	tags: {
		go: "The language most of my services are written in, and its standard library.",
		postgres: "The database under almost everything here: queries, pooling, vacuum and WAL.",
		"self-hosting": "Running your own software on a server you rent, and keeping it running.",
		backups: "Copies of the data, and the restore drills that prove they work.",
		concurrency: "Goroutines, contexts, locks and queues: doing several things safely.",
		observability: "Logs, metrics and query plans: seeing what a service is doing.",
		linux: "systemd, users, permissions and the rest of the box under the service.",
		networking: "DNS, TLS and the proxies between the internet and the binary.",
	},
	posts: Object.fromEntries(
		Object.entries(POST_MODULES).map(([key, load]) => [key.slice("./posts/".length, -3), load]),
	),
	about: () => <SaltboxAbout />,
	pageSize: 6,
	render: (view, context) => <SaltboxPage view={view} context={context} />,
};

export default SALTBOX;
