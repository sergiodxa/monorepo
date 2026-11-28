/**
 * Understory, an invented personal blog by a software developer about local-first software,
 * sync and tools for thought, drawn as a garden: curated ways in, then every post as a card
 * sized by its weight. Its posts are the Markdown files in `posts/`, named by their slug.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DemoBlogSite } from "~/resources/views/demo-blogs";

import { UnderstoryAbout } from "~/resources/views/demo-blogs/understory/about";
import { UnderstoryPage } from "~/resources/views/demo-blogs/understory/pages";

/** Every post's source, keyed by its path relative to this file. */
const POST_MODULES = import.meta.glob<string>("./posts/*.md", {
	query: "?raw",
	import: "default",
});

/** Moss green at hue 135, low in chroma so it reads as growth under shade rather than lime. */
const BRAND = [
	"oklch(0.976 0.018 135)",
	"oklch(0.946 0.035 135)",
	"oklch(0.892 0.06 135)",
	"oklch(0.812 0.085 135)",
	"oklch(0.705 0.098 135)",
	"oklch(0.595 0.098 135)",
	"oklch(0.505 0.088 135)",
	"oklch(0.425 0.076 135)",
	"oklch(0.345 0.06 135)",
	"oklch(0.27 0.044 135)",
	"oklch(0.205 0.03 135)",
] as const;

/** Warm paper neutrals leaning yellow, so the moss sits on parchment and soil, not on grey. */
const NEUTRAL = [
	"oklch(0.972 0.014 88)",
	"oklch(0.948 0.018 88)",
	"oklch(0.9 0.02 88)",
	"oklch(0.82 0.02 88)",
	"oklch(0.71 0.019 88)",
	"oklch(0.6 0.018 88)",
	"oklch(0.5 0.016 88)",
	"oklch(0.41 0.014 88)",
	"oklch(0.31 0.012 88)",
	"oklch(0.225 0.01 88)",
	"oklch(0.168 0.008 88)",
] as const;

/** A humanist book serif with calligraphic stress, for titles and long reading alike. */
const SERIF =
	"'Palatino Linotype', Palatino, 'Book Antiqua', 'URW Palladio L', P052, 'Iowan Old Style', Georgia, serif";

/** A humanist sans for labels and chips, the quiet voice beside the serif. */
const LABEL_SANS = "Optima, Candara, 'Gill Sans', 'Noto Sans', 'Segoe UI', system-ui, sans-serif";

/** The Understory mark: a fern frond rising from a low mound of soil. */
function mark() {
	return (
		<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
			<path
				d="M3 20.5c2.5-1.6 5.6-2.4 9-2.4s6.5.8 9 2.4"
				fill="none"
				stroke="var(--ui-color-neutral-500)"
				stroke-width="1.6"
				stroke-linecap="round"
			/>
			<path
				d="M12 18V5.5M12 7.5c-1.6-.4-3-1.4-3.6-2.8M12 7.5c1.6-.4 3-1.4 3.6-2.8M12 11c-2-.3-3.8-1.4-4.8-3M12 11c2-.3 3.8-1.4 4.8-3M12 14.5c-2.4-.2-4.4-1.3-5.6-3M12 14.5c2.4-.2 4.4-1.3 5.6-3"
				fill="none"
				stroke="var(--ui-color-brand-600)"
				stroke-width="1.6"
				stroke-linecap="round"
			/>
		</svg>
	);
}

/**
 * The blog: five kinds in one feed, a vocabulary of seven topics, and an author who links out
 * to two profiles. The kinds' order is the order the filter bar and the header offer them.
 */
const UNDERSTORY: DemoBlogSite = {
	name: "Understory",
	kind: "Personal blog",
	tagline: "Local-first software, tended slowly, by Wren Halloran.",
	artDirection: "Warm paper, moss greens and a humanist serif",
	description:
		"Essays, tutorials, notes, links and a glossary about local-first software, sync and tools for thought, by an invented software developer.",
	mark,
	theme: {
		brand: BRAND,
		neutral: NEUTRAL,
		tokens: {
			"--demo-blog-heading-font": SERIF,
			"--demo-blog-heading-weight": "600",
			"--demo-blog-reading-font": SERIF,
			"--understory-label-font": LABEL_SANS,
			"--ui-radius-md": "0.625rem",
			"--ui-radius-lg": "1.125rem",
		},
	},
	author: {
		name: "Wren Halloran",
		role: "Software developer in Bristol, building sync engines",
		initials: "WH",
		bio: "I build apps that keep working when the network does not: local databases, sync engines and the merge rules between them. Understory is where I keep what I learn, revisited and updated rather than left to age.",
		links: [
			{ label: "Fediverse", href: "https://social.example/@wren" },
			{ label: "Code", href: "https://code.example/wren" },
		],
	},
	kinds: {
		articles: {
			label: "Essays",
			singular: "Essay",
			description: "Long, evergreen arguments about local-first software, revisited as I learn.",
		},
		tutorials: {
			label: "Tutorials",
			singular: "Tutorial",
			description: "Builds to follow step by step, including the Sync from scratch series.",
		},
		notes: {
			label: "Notes",
			singular: "Note",
			description: "Small observations from the work, short enough to read in full here.",
			layout: "note",
		},
		links: {
			label: "Links",
			singular: "Link",
			description: "Pages elsewhere that shaped how I build, each with why I keep it.",
			layout: "bookmark",
		},
		glossary: {
			label: "Glossary",
			singular: "Term",
			description:
				"The vocabulary of sync, one definition each, linked from everywhere it is used.",
			layout: "term",
		},
	},
	tags: {
		"local-first": "Software whose data lives on your devices first and syncs second.",
		sync: "Moving changes between replicas, and agreeing on the result.",
		crdts: "Data types that merge without a referee, and when to reach for one.",
		sqlite: "The small database that runs on every replica, the browser included.",
		"browser-storage": "OPFS, IndexedDB, quotas and the eviction rules around them.",
		offline: "Apps that keep their promises without a network.",
		"tools-for-thought": "Notes, links and the software we think with.",
	},
	posts: Object.fromEntries(
		Object.entries(POST_MODULES).map(([key, load]) => [key.slice("./posts/".length, -3), load]),
	),
	about: () => <UnderstoryAbout />,
	pageSize: 10,
	render: (view, context) => <UnderstoryPage view={view} context={context} />,
};

export default UNDERSTORY;
