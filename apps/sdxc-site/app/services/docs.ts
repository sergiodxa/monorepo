/**
 * The handwritten guides: every file under `resources/docs`, its frontmatter held to
 * one schema, and the ordered sections the shell's sidebar is drawn from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Markdown } from "@sdxc/markdown";
import { isSuccess } from "@sdxc/result";
import * as s from "remix/data-schema";

import { TAGS } from "~/app/services/content";

/**
 * What every guide states about itself. `section` is written per file rather than
 * derived from the directory so a guide can be moved on disk without changing where
 * it reads in the sidebar.
 */
const frontmatterSchema = s.object({
	title: s.string(),
	description: s.string(),
	section: s.object({ title: s.string(), order: s.number() }),
	order: s.number(),
	lastUpdated: s.string(),
	/**
	 * What a reader knows after the guide, each finishing "you will know…", shown under the
	 * title; every guide lists three, so the list reads the same on every page.
	 */
	outcomes: s.array(s.string()).refine((list) => list.length === 3, "List three outcomes"),
});

export type GuideFrontmatter = s.InferOutput<typeof frontmatterSchema>;

/**
 * Hoisted so the sidebar's frontmatter-only read and a page's full parse agree. A
 * guide is written in the same vocabulary as the rest of the site's copy, so a tag a
 * landing section uses reads the same way inside a guide.
 */
export const MARKDOWN_OPTIONS = {
	frontmatter: frontmatterSchema,
	tags: TAGS,
} satisfies Markdown.Options;

/** Where the glob's keys start, and the prefix a slug is the remainder of. */
const DOCS_PREFIX = "../../resources/docs/";

const guideLoaders = import.meta.glob<string>("../../resources/docs/**/*.md", {
	query: "?raw",
	import: "default",
});

/** One guide, as the sidebar and the hub list it. */
export interface GuideEntry {
	/** The path under `/docs`, e.g. `conventions/naming`. */
	slug: string;
	frontmatter: GuideFrontmatter;
}

/** A titled run of guides, in the order they are meant to be read. */
export interface GuideSection {
	title: string;
	order: number;
	guides: GuideEntry[];
}

/**
 * Every guide, grouped into sections ordered by `section.order` and each section's
 * guides by their own `order`.
 */
export async function listGuides(): Promise<GuideSection[]> {
	let sections = new Map<string, GuideSection>();

	for (let [path, load] of Object.entries(guideLoaders)) {
		let parsed = Markdown.frontmatter(await load(), MARKDOWN_OPTIONS);
		if (!isSuccess(parsed)) continue;

		let { frontmatter } = parsed.data;
		let slug = path.slice(DOCS_PREFIX.length).replace(/\.md$/, "");

		let section = sections.get(frontmatter.section.title);
		if (!section) {
			section = { title: frontmatter.section.title, order: frontmatter.section.order, guides: [] };
			sections.set(frontmatter.section.title, section);
		}

		section.guides.push({ slug, frontmatter });
	}

	for (let section of sections.values()) {
		section.guides.sort((a, b) => a.frontmatter.order - b.frontmatter.order);
	}

	return Array.from(sections.values()).sort((a, b) => a.order - b.order);
}

/** The source of one guide, or `null` when no file answers to that slug. */
export async function readGuide(slug: string): Promise<string | null> {
	let load = guideLoaders[`${DOCS_PREFIX}${slug}.md`];
	if (!load) return null;
	return await load();
}

/**
 * The guides that link to a package's reference page, in reading order. A link in a
 * guide's prose is the author pointing a reader at the package, so the list holds the
 * guides written about it.
 *
 * @param name - The package's directory, the segment its page answers under `/api`.
 */
export async function listGuidesAbout(name: string): Promise<GuideEntry[]> {
	let links = [`](/api/${name})`, `](/api/${name}#`];
	let guides: GuideEntry[] = [];

	for (let section of await listGuides()) {
		for (let guide of section.guides) {
			let source = (await readGuide(guide.slug)) ?? "";
			if (links.some((link) => source.includes(link))) guides.push(guide);
		}
	}

	return guides;
}

/**
 * One line per guide section, saying what the section gets a reader, for the hub's cards.
 * Keyed by the `section.title` the guides' frontmatter names.
 */
const SECTION_DESCRIPTIONS: Readonly<Record<string, string>> = {
	"Getting started":
		"What the collection is, how it fits together, and a first app built and deployed.",
	"Packages à la carte":
		"Install a few packages into a project you already have, with or without Remix.",
	Recipes: "Whole features end to end: a blog, a contact form, API keys, paging on an outage.",
	"The sdxc command": "Start a project, inspect and check it, run its commands and deploy it.",
	"Generate files": "One guide per sdxc make kind: where each file goes and how to fill it in.",
	Conventions: "The rules every package keeps: results over throws, naming, logging, validation.",
	"Routing & forms": "Wire the router, validate input, translate pages and serve them to crawlers.",
	Interface: "Build pages with remix/component: landings, search, shortcuts and calendars.",
	"HTTP APIs": "JSON APIs with problem details, OpenAPI, typed clients and safe writes.",
	"Sign-in & access": "OpenID Connect, passkeys, two-factor, tokens, SSO and permissions.",
	Security: "Webhooks, headers, signatures and keeping bots and abuse out.",
	"Data & billing": "Tables, queries, caching, search, flags and charging for your app.",
	"Jobs, email & alerts": "Background jobs and cron, sending and reading mail, and notifications.",
	"File & data formats":
		"CSV, JSON Lines, ZIP, CBOR, JSON Pointer and other formats to read and write.",
	Markdown: "A markdown pipeline with plugins, variables, live regions and embeds.",
	"Feeds & federation": "RSS, Atom, calendar feeds, IndieWeb and ActivityPub.",
	"Images & documents": "Social cards, QR codes, charts, diagrams, math, PDFs and ebooks.",
	"Testing & monitoring":
		"Tests, specs, budgets, CI, then logs, health checks and costs in production.",
	"Command lines": "Your app's command line, your own tools, and configuration files.",
	"Agents & MCP": "Expose your app over MCP, call other servers, and bridge older clients.",
	Releases: "How releases are numbered, what breaks between them, and the license.",
};

/**
 * The line the hub shows under a section, or the section's first guide's description when
 * no line is written for it yet, so a new section still reads as a sentence.
 *
 * @param section - The section as {@link listGuides} returns it.
 */
export function describeSection(section: GuideSection): string {
	return SECTION_DESCRIPTIONS[section.title] ?? section.guides.at(0)?.frontmatter.description ?? "";
}

/**
 * The path a newcomer reads first: the guides of the earliest section, in order. The hub
 * draws them as its "Start here" cards and the 404 offers them as places to begin.
 */
export async function listStartGuides(): Promise<GuideEntry[]> {
	return (await listGuides()).at(0)?.guides ?? [];
}

/**
 * Whether every section has its own line on the hub, so a section added without one is
 * caught by a test rather than read off its first guide.
 */
export function hasSectionDescription(title: string): boolean {
	return Object.hasOwn(SECTION_DESCRIPTIONS, title);
}
