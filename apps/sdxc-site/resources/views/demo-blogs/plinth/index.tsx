/**
 * Plinth, an invented personal blog by a design-systems engineer about CSS, typography and
 * design tokens: articles, a tutorial series, notes, links and a glossary in one feed, set as
 * an editorial index. Its posts are the Markdown files in `posts/`, named by their slug.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DemoBlogSite } from "~/resources/views/demo-blogs";

import { PlinthAbout } from "~/resources/views/demo-blogs/plinth/about";
import { PlinthPage } from "~/resources/views/demo-blogs/plinth/pages";

/** Every post's source, keyed by its path relative to this file. */
const POST_MODULES = import.meta.glob<string>("./posts/*.md", {
	query: "?raw",
	import: "default",
});

/**
 * A signal vermilion at hue 33. Step 400 is the colour block ink-black type sits on in both
 * schemes; step 600 carries white text and links on paper at better than 4.5:1.
 */
const BRAND = [
	"oklch(0.97 0.018 40)",
	"oklch(0.94 0.04 40)",
	"oklch(0.88 0.085 38)",
	"oklch(0.8 0.135 36)",
	"oklch(0.72 0.175 35)",
	"oklch(0.64 0.195 34)",
	"oklch(0.54 0.19 33)",
	"oklch(0.46 0.16 33)",
	"oklch(0.38 0.13 33)",
	"oklch(0.3 0.1 33)",
	"oklch(0.21 0.07 33)",
] as const;

/** Cool ink neutrals: near-white paper in light mode, ink black in dark. */
const NEUTRAL = [
	"oklch(0.99 0.002 265)",
	"oklch(0.965 0.003 265)",
	"oklch(0.915 0.005 265)",
	"oklch(0.83 0.007 265)",
	"oklch(0.71 0.009 265)",
	"oklch(0.58 0.01 265)",
	"oklch(0.48 0.01 265)",
	"oklch(0.39 0.01 265)",
	"oklch(0.29 0.01 265)",
	"oklch(0.2 0.008 265)",
	"oklch(0.14 0.006 265)",
] as const;

/** A heavy neo-grotesk for headlines and the wordmark, the platform's own where installed. */
const GROTESK = "'Helvetica Neue', Helvetica, 'Nimbus Sans', Arial, sans-serif";

/** The system's own sans for long reading, tuned for screens on every platform. */
const READING =
	"ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif";

/** The Plinth mark: a signal square standing on an ink plinth. */
function mark() {
	return (
		<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
			<rect x="7" y="2" width="10" height="10" fill="var(--ui-color-brand-500)" />
			<rect x="2" y="14" width="20" height="8" fill="currentColor" />
		</svg>
	);
}

/**
 * The blog: five kinds in one feed, a tag vocabulary for the craft, and an author who links
 * out to two profiles. The kinds' order is the order every filter offers them in.
 */
const PLINTH: DemoBlogSite = {
	name: "Plinth",
	kind: "Personal blog",
	tagline: "CSS, type and the systems under them, by Teodora Vass.",
	artDirection: "Ink black, signal vermilion and a heavy grotesk",
	description:
		"Articles, tutorials, notes, links and a glossary about CSS, typography and design systems, by an invented design-systems engineer.",
	mark,
	theme: {
		brand: BRAND,
		neutral: NEUTRAL,
		tokens: {
			"--demo-blog-heading-font": GROTESK,
			"--demo-blog-heading-weight": "800",
			"--demo-blog-reading-font": READING,
			"--ui-radius-sm": "0",
			"--ui-radius-md": "0.125rem",
			"--ui-radius-lg": "0.25rem",
		},
	},
	author: {
		name: "Teodora Vass",
		role: "Design-systems engineer in Rotterdam",
		initials: "TV",
		bio: "I build the parts of a product nobody should have to think about: type scales, tokens and the components that read them. Plinth is the base I keep my notes on, so the next system starts from what the last one taught me.",
		links: [
			{ label: "Mastodon", href: "https://mastodon.example/@teodora" },
			{ label: "GitHub", href: "https://code.example/teodora" },
		],
	},
	kinds: {
		articles: {
			label: "Articles",
			singular: "Article",
			description: "Arguments about how design systems should be built, and why.",
		},
		tutorials: {
			label: "Tutorials",
			singular: "Tutorial",
			description: "Builds to follow step by step, including a three-part token pipeline.",
		},
		notes: {
			label: "Notes",
			singular: "Note",
			description: "One CSS or type detail at a time, short enough to open in the index.",
			layout: "note",
		},
		links: {
			label: "Links",
			singular: "Link",
			description: "Tools and reading elsewhere, each with a line on why it is here.",
			layout: "bookmark",
		},
		glossary: {
			label: "Glossary",
			singular: "Term",
			description: "The words type and tokens lean on, defined once and linked from everywhere.",
			layout: "term",
		},
	},
	tags: {
		typography: "Scales, measure, leading and the faces that carry them.",
		css: "The language itself: new properties, old ones used well.",
		tokens: "Naming decisions once and shipping them everywhere.",
		components: "APIs for the parts a product is assembled from.",
		color: "Palettes, themes and contrast that holds in both schemes.",
		accessibility: "Making sure the system works for every reader.",
		layout: "Grids, containers and components that fit where they land.",
	},
	posts: Object.fromEntries(
		Object.entries(POST_MODULES).map(([key, load]) => [key.slice("./posts/".length, -3), load]),
	),
	about: () => <PlinthAbout />,
	pageSize: 10,
	render: (view, context) => <PlinthPage view={view} context={context} />,
};

export default PLINTH;
