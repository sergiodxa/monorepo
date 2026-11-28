/**
 * The showcase's items and their case studies. Each case study is a Markdown file in
 * `resources/content/showcase/<slug>.md`, written to be reviewed as prose; what an item is
 * built from is read from its source at build time, and its links from the routes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { Markdown } from "@sdxc/markdown";
import { failure, isFailure, isSuccess, success } from "@sdxc/result";

import type { CaseStudyFrontmatter } from "~/app/services/case-study-schema";
import type { ShowcaseCategory, ShowcaseKind } from "~/app/services/showcase-kinds";
import type { ImageSize, ShowcaseUsage } from "~/scripts/showcase-usage";

import { prepareArticle } from "~/app/services/article";
import { CASE_STUDY_FRONTMATTER } from "~/app/services/case-study-schema";
import { TAGS } from "~/app/services/content";
import { findDemoKind } from "~/app/services/demos";
import { APPLICATIONS, PRODUCTION_LANDINGS } from "~/resources/content/apps";
import routes from "~/routes/web";

/** Where every application's and demo's source is read. */
const REPOSITORY_TREE = "https://github.com/sergiodxa/monorepo/tree/main/apps";

/** Where each kind of demo's folders live under the site's source. */
const DEMO_FOLDERS: Record<ShowcaseCategory, string> = {
	landing: "sdxc-site/resources/views/demos",
	docs: "sdxc-site/resources/views/demo-docs",
	app: "sdxc-site/resources/views/demo-apps",
	blog: "sdxc-site/resources/views/demo-blogs",
};

/** The `?kind=` values the showcase filters by, `all` showing everything. */
export const SHOWCASE_FILTERS = [
	"all",
	"production",
	"demo",
	"app",
	"landing",
	"docs",
	"blog",
] as const;

/** One of {@link SHOWCASE_FILTERS}. */
export type ShowcaseFilter = (typeof SHOWCASE_FILTERS)[number];

/** The filter that lists an item beside its peers: every production item together, a demo by kind. */
export function filterOf(item: Pick<ShowcaseItem, "kind" | "category">): ShowcaseFilter {
	return item.kind === "production" ? "production" : item.category;
}

/** The options every case study is parsed with, so the index and the page read it alike. */
export const CASE_STUDY_OPTIONS = {
	frontmatter: CASE_STUDY_FRONTMATTER,
	tags: TAGS,
} satisfies Markdown.Options;

/** Every case study's source, keyed by its path relative to this module. */
const CASE_STUDIES = import.meta.glob<string>("../../resources/content/showcase/*.md", {
	query: "?raw",
	import: "default",
});

/** The glob key's prefix, which a slug is the remainder of before `.md`. */
const CASE_STUDY_PREFIX = "../../resources/content/showcase/";

/** The cover screenshot, with the address its image is served at. */
export interface ShowcaseCover extends ImageSize {
	src: string;
	alt: string;
	viewport: "desktop" | "phone";
}

/**
 * Every screenshot's pixel size, written by the extractor at build time. It is bundled with the
 * page, so each image's box is reserved in the first HTML and nothing shifts as shots load.
 */
const SHOT_SIZES = import.meta.glob<{ sizes: Record<string, ImageSize> }>(
	"../../resources/generated/showcase-shots.json",
	{ import: "default", eager: true },
);

/** The viewport a shot fills when the extractor has not measured it, the desktop capture's. */
const DESKTOP_SHOT: ImageSize = { width: 1440, height: 900 };

/**
 * A screenshot's intrinsic size, which its light and dark captures share in aspect ratio.
 *
 * @param src The shot's address, as {@link screenshotSrc} names it.
 * @returns The size, or `null` for a shot the extractor has not measured.
 */
export function shotSize(src: string): ImageSize | null {
	return Object.values(SHOT_SIZES)[0]?.sizes[src] ?? null;
}

/** One showcase item as a card, a filter and a case study read it. */
export interface ShowcaseItem {
	slug: string;
	title: string;
	headline: string;
	summary: string;
	kind: ShowcaseKind;
	category: ShowcaseCategory;
	/** The case study's address. */
	href: string;
	/** Where the item runs: its live site, its demo, or `null` for source alone. */
	liveHref: string | null;
	sourceHref: string;
	/** The shot set under the headline and on the card, `null` when the cover names no shot. */
	cover: ShowcaseCover | null;
	/** Every shot's address, in front matter order, for the page to check its images against. */
	shots: string[];
}

/**
 * The address of a case study's screenshot. Shots sit beside the case study's address, so a
 * reader who opens one sees whose it is, and the Markdown names them by the same address.
 *
 * @param slug The item's slug.
 * @param id The shot's id in its front matter.
 * @example screenshotSrc("wayfern", "fare-calendar") // "/showcase/wayfern/fare-calendar.webp"
 */
export function screenshotSrc(slug: string, id: string): string {
	return `${routes.showcase.show.href({ slug })}/${id}.webp`;
}

/** The media query a screenshot's dark capture answers, the one the site's theme switches on. */
export const DARK_SCHEME = "(prefers-color-scheme: dark)";

/** Its complement, which every reader the dark capture leaves out matches, a missing preference included. */
export const LIGHT_SCHEME = "not all and (prefers-color-scheme: dark)";

/**
 * The dark-scheme twin of a screenshot, captured from the same page with the reader's system
 * set to dark, so a shot matches the page around it in either scheme.
 *
 * @example darkScreenshotSrc("/showcase/wayfern/fare-calendar.webp") // "/showcase/wayfern/fare-calendar-dark.webp"
 */
export function darkScreenshotSrc(src: string): string {
	return src.replace(/\.webp$/, "-dark.webp");
}

/**
 * The showcase's address, narrowed to one filter.
 *
 * @param filter What `?kind=` narrows to; `all` and none give the bare address.
 * @example showcaseHref("demo") // "/showcase?kind=demo"
 */
export function showcaseHref(filter?: ShowcaseFilter): string {
	let href = routes.showcase.index.href();
	return filter === undefined || filter === "all" ? href : `${href}?kind=${filter}`;
}

/**
 * Whether an item belongs under a filter.
 *
 * @param item The item.
 * @param filter The `?kind=` the showcase was asked for.
 */
export function matchesFilter(item: ShowcaseItem, filter: ShowcaseFilter): boolean {
	if (filter === "all") return true;
	if (filter === "demo" || filter === "production") return item.kind === filter;
	return item.kind === "demo" && item.category === filter;
}

/**
 * Reads `?kind=` into a filter; anything else shows everything.
 *
 * @param value The parameter, or `null` when the address has none.
 */
export function readFilter(value: string | null): ShowcaseFilter {
	return SHOWCASE_FILTERS.find((filter) => filter === value) ?? "all";
}

/**
 * Every case study's slug, in name order, read from the file names alone.
 *
 * @returns One slug per Markdown file.
 */
export function listCaseStudySlugs(): string[] {
	return Object.keys(CASE_STUDIES)
		.map((key) => key.slice(CASE_STUDY_PREFIX.length, -".md".length))
		.sort();
}

/**
 * A case study's raw Markdown.
 *
 * @returns The source, or `null` for a slug with no file.
 */
export async function readCaseStudySource(slug: string): Promise<string | null> {
	let key = `${CASE_STUDY_PREFIX}${slug}.md`;
	if (!Object.hasOwn(CASE_STUDIES, key)) return null;
	return (await CASE_STUDIES[key]?.()) ?? null;
}

/**
 * Where an item runs and where its source is, by kind: an application in production names
 * its own site and workspace, a production landing its page and views folder, a demo its
 * address under `/showcase` and its folder.
 */
function itemLinks(
	slug: string,
): Pick<ShowcaseItem, "kind" | "category" | "liveHref" | "sourceHref"> | null {
	let application = APPLICATIONS.find((entry) => entry.directory === slug);
	if (application !== undefined) {
		return {
			kind: "production",
			category: "app",
			liveHref: application.href,
			sourceHref: `${REPOSITORY_TREE}/${application.directory}`,
		};
	}
	let landing = PRODUCTION_LANDINGS.find((entry) => entry.slug === slug);
	if (landing !== undefined) {
		return {
			kind: "production",
			category: "landing",
			liveHref: landing.href,
			sourceHref: `${REPOSITORY_TREE}/${landing.application}/${landing.folder}`,
		};
	}
	let demo = findDemoKind(slug);
	if (demo === null) return null;
	return {
		kind: "demo",
		category: demo,
		liveHref: routes.showcase.demo.href({ slug }),
		sourceHref: `${REPOSITORY_TREE}/${DEMO_FOLDERS[demo]}/${slug}`,
	};
}

/**
 * Builds an item from its slug and its case study's front matter.
 *
 * @returns The item, or `null` for a slug that is neither an application nor a demo.
 */
export function toShowcaseItem(
	slug: string,
	frontmatter: CaseStudyFrontmatter,
): ShowcaseItem | null {
	let links = itemLinks(slug);
	if (links === null) return null;
	let cover = frontmatter.shots.find((shot) => shot.id === frontmatter.cover);
	return {
		slug,
		title: frontmatter.title,
		headline: frontmatter.headline,
		summary: frontmatter.summary,
		href: routes.showcase.show.href({ slug }),
		cover:
			cover === undefined
				? null
				: {
						src: screenshotSrc(slug, cover.id),
						alt: cover.alt,
						viewport: cover.viewport ?? "desktop",
						...(shotSize(screenshotSrc(slug, cover.id)) ?? DESKTOP_SHOT),
					},
		shots: frontmatter.shots.map((shot) => screenshotSrc(slug, shot.id)),
		...links,
	};
}

/** Apps, then landings, docs sites and blogs, within production and within the demos. */
const CATEGORY_ORDER: ShowcaseCategory[] = ["app", "landing", "docs", "blog"];

/**
 * Every showcase item with a case study, applications in production first, then the demos by
 * kind and title. A case study whose front matter fails to read is left out, and the
 * case-study tests name it.
 */
export async function listShowcaseItems(): Promise<ShowcaseItem[]> {
	let items = await Promise.all(
		listCaseStudySlugs().map(async (slug) => {
			let source = await readCaseStudySource(slug);
			if (source === null) return null;
			let parsed = Markdown.frontmatter(source, CASE_STUDY_OPTIONS);
			return isSuccess(parsed) ? toShowcaseItem(slug, parsed.data.frontmatter) : null;
		}),
	);
	return items
		.filter((item): item is ShowcaseItem => item !== null)
		.sort(
			(a, b) =>
				Number(a.kind === "demo") - Number(b.kind === "demo") ||
				CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
				a.title.localeCompare(b.title),
		);
}

/** One case study, ready to render. */
export interface CaseStudy {
	item: ShowcaseItem;
	document: Markdown.Document;
	usage: ShowcaseUsage;
}

/** What the extractor wrote, loaded only by a page that names what an item is built from. */
const USAGE_DOCUMENTS = import.meta.glob<{ usage: Record<string, ShowcaseUsage> }>(
	"../../resources/generated/showcase-usage.json",
	{ import: "default" },
);

/** Every item's usage, keyed by slug; empty before the extractor has run. */
async function readAllUsage(): Promise<Record<string, ShowcaseUsage>> {
	let load = Object.values(USAGE_DOCUMENTS)[0];
	return load === undefined ? {} : (await load()).usage;
}

/**
 * What an item is built from, as its source imports it.
 *
 * @returns The packages and catalogue entries, empty for a slug the extractor did not see.
 */
export async function readUsage(slug: string): Promise<ShowcaseUsage> {
	return (await readAllUsage())[slug] ?? { packages: [], components: [] };
}

/**
 * Turns each top-level paragraph holding nothing but an image into the image itself, so the
 * page draws a figure with a caption where the Markdown placed a screenshot between paragraphs.
 */
function liftFigures(document: Markdown.Document): Markdown.Document {
	return {
		...document,
		children: document.children.map((node) => {
			if (node.type !== "paragraph" || node.children.length !== 1) return node;
			let [only] = node.children;
			return only?.type === "image" ? (only as unknown as Markdown.Paragraph) : node;
		}),
	};
}

/**
 * Reads and prepares one case study.
 *
 * @returns The case study, `null` for a slug with none, or the parse failure with its position.
 */
export async function readCaseStudy(slug: string): Promise<Result<CaseStudy | null, Error>> {
	let source = await readCaseStudySource(slug);
	if (source === null) return success(null);
	let parsed = Markdown.parse(source, CASE_STUDY_OPTIONS);
	if (isFailure(parsed)) return failure(parsed.error);
	let prepared = prepareArticle(parsed.data.document, CASE_STUDY_OPTIONS);
	if (isFailure(prepared)) return failure(prepared.error);
	let item = toShowcaseItem(slug, parsed.data.frontmatter);
	if (item === null) return success(null);
	return success({ item, document: liftFigures(prepared.data), usage: await readUsage(slug) });
}
