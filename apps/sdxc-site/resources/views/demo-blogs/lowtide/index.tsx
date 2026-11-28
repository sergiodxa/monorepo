/**
 * Low Tide, an invented personal blog by a platform engineer about HTTP, caching and the
 * edge: articles, a tutorial series, short notes, links and a glossary, all in one feed. Its
 * posts are the Markdown files in `posts/`, named by their slug.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DemoBlogSite } from "~/resources/views/demo-blogs";

import { LowTideAbout } from "~/resources/views/demo-blogs/lowtide/about";
import { LowTidePage } from "~/resources/views/demo-blogs/lowtide/pages";

/** Every post's source, keyed by its path relative to this file. */
const POST_MODULES = import.meta.glob<string>("./posts/*.md", {
	query: "?raw",
	import: "default",
});

/** A deep sea-glass teal at hue 195, cool enough to read as water rather than mint. */
const BRAND = [
	"oklch(0.984 0.012 195)",
	"oklch(0.953 0.03 195)",
	"oklch(0.9 0.058 195)",
	"oklch(0.82 0.085 195)",
	"oklch(0.71 0.1 195)",
	"oklch(0.6 0.1 195)",
	"oklch(0.51 0.09 195)",
	"oklch(0.43 0.078 195)",
	"oklch(0.35 0.062 195)",
	"oklch(0.27 0.046 195)",
	"oklch(0.2 0.032 195)",
] as const;

/** Sand neutrals, faintly warm, so the cool accent sits on paper rather than on grey. */
const NEUTRAL = [
	"oklch(0.985 0.005 85)",
	"oklch(0.963 0.008 85)",
	"oklch(0.918 0.011 85)",
	"oklch(0.835 0.013 85)",
	"oklch(0.72 0.014 85)",
	"oklch(0.6 0.014 85)",
	"oklch(0.5 0.013 85)",
	"oklch(0.41 0.012 85)",
	"oklch(0.31 0.01 85)",
	"oklch(0.22 0.008 85)",
	"oklch(0.16 0.006 85)",
] as const;

/** A book serif for titles and long reading, the reader's own where none is installed. */
const SERIF =
	"Charter, 'Bitstream Charter', 'Iowan Old Style', 'Sitka Text', Cambria, Georgia, serif";

/** The Low Tide mark: a sun low over two lines of water. */
function mark() {
	return (
		<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
			<circle cx="12" cy="10" r="5" fill="var(--ui-color-brand-500)" />
			<path
				d="M3 15.5c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0 3 1 4.5 0M5 19.5c1.2-.8 2.4-.8 3.6 0s2.4.8 3.6 0 2.4-.8 3.6 0 2.4.8 3.2.2"
				fill="none"
				stroke="var(--ui-color-brand-700)"
				stroke-width="1.75"
				stroke-linecap="round"
			/>
		</svg>
	);
}

/**
 * The blog: five kinds in one feed, a terse tag vocabulary, and an author who links out to
 * two profiles. The kinds' order is the order the feed's filter and the header offer them.
 */
const LOW_TIDE: DemoBlogSite = {
	name: "Low Tide",
	kind: "Personal blog",
	tagline: "Slow notes on fast websites, by Maren Okafor.",
	artDirection: "Sand paper, sea-glass teal and a book serif",
	description:
		"Articles, tutorials, notes, links and a glossary about HTTP, caching and the edge, by an invented platform engineer.",
	mark,
	theme: {
		brand: BRAND,
		neutral: NEUTRAL,
		tokens: {
			"--demo-blog-heading-font": SERIF,
			"--demo-blog-heading-weight": "600",
			"--demo-blog-reading-font": SERIF,
			"--ui-radius-md": "0.375rem",
			"--ui-radius-lg": "0.625rem",
		},
	},
	author: {
		name: "Maren Okafor",
		role: "Platform engineer in Lisbon",
		initials: "MO",
		bio: "I build the layer between a website and the people waiting for it: caches, CDNs and the HTTP that ties them together. Low Tide is where I write down what I learn, slowly, so it stays learned.",
		links: [
			{ label: "Mastodon", href: "https://mastodon.example/@maren" },
			{ label: "GitHub", href: "https://code.example/maren" },
		],
	},
	kinds: {
		articles: {
			label: "Articles",
			singular: "Article",
			description: "Long-form arguments about how the web is delivered, and what it costs.",
		},
		tutorials: {
			label: "Tutorials",
			singular: "Tutorial",
			description: "Step-by-step builds you can follow along with, some in series.",
		},
		notes: {
			label: "Notes",
			singular: "Note",
			description: "Short things I learned this week, small enough to read in the feed.",
			layout: "note",
		},
		links: {
			label: "Links",
			singular: "Link",
			description: "Pages elsewhere worth your time, each with why I saved it.",
			layout: "bookmark",
		},
		glossary: {
			label: "Glossary",
			singular: "Term",
			description: "The words caching and delivery lean on, defined once and linked everywhere.",
			layout: "term",
		},
	},
	tags: {
		caching: "How responses are stored, reused, revalidated and thrown away.",
		http: "Headers, methods and status codes: the protocol under everything here.",
		edge: "Running code and keeping content close to the people asking for it.",
		performance: "Where the milliseconds go, and how to get them back.",
		css: "Styles that survive real content and real redesigns.",
		accessibility: "Making sure the fast page is also one everyone can use.",
		databases: "The storage under the cache, chosen to be boring.",
	},
	posts: Object.fromEntries(
		Object.entries(POST_MODULES).map(([key, load]) => [key.slice("./posts/".length, -3), load]),
	),
	about: () => <LowTideAbout />,
	pageSize: 8,
	render: (view, context) => <LowTidePage view={view} context={context} />,
};

export default LOW_TIDE;
