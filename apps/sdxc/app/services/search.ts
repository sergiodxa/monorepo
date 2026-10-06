/**
 * The search corpus: one entry per page, plus one per heading a reader can jump to,
 * across the guides, every package reference and every page of the two catalogues. It is read off the markdown sources
 * already in the bundle by a line scan rather than a parse, because the corpus runs to
 * well over a megabyte and a full parse of all of it is work no request should pay for.
 *
 * The result is held for the life of the isolate, so the scan happens once inside the
 * first request that needs it rather than in the worker's global scope, where the upload
 * validator rejects the work.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SearchDocument } from "~/app/services/search-query";

import { BOILERPLATE_SECTIONS, slugify } from "~/app/services/article";
import { listCataloguePages } from "~/app/services/catalogue-pages";
import { listGuides, readGuide } from "~/app/services/docs";
import { listPackageGroups, readPackageReadme } from "~/app/services/packages";
import { includesWord, rankDocuments, tokenize } from "~/app/services/search-query";
import routes from "~/routes/web";

/** Heading depths the corpus carries, matching the depths a page's own nav offers. */
const INDEXED_LEVELS = new Set([2, 3]);

/** How the package half of the corpus is labelled when a result names its section. */
const PACKAGE_SECTION_PREFIX = "Packages";

/** Score for a word in the name or the one-line description, which is what a package is. */
const NAMED_SCORE = 10;

/** Score for a word the README merely uses, which every long README uses many of. */
const MENTIONED_SCORE = 1;

/** One heading, as the scan reads it off a source file. */
interface ScannedHeading {
	level: number;
	text: string;
	/** The fragment the rendered page gives this heading, so a result links to it. */
	id: string;
}

/** What a package search answers with: enough to decide, and the page to read next. */
export interface PackageMatch {
	name: string;
	directory: string;
	description: string;
	href: string;
	/** The page's `.md` twin, which is what an agent reads the package from. */
	markdownHref: string;
}

/** Strips the frontmatter block a guide opens with, which is data rather than prose. */
function withoutFrontmatter(source: string): string {
	if (!source.startsWith("---")) return source;
	let end = source.indexOf("\n---", 3);
	if (end === -1) return source;
	return source.slice(source.indexOf("\n", end + 1) + 1);
}

/** What a heading reads as once its inline markup and its annotations are taken off. */
function toPlainHeading(text: string): string {
	return text
		.replace(/\{%[^%]*%\}/g, "")
		.replace(/`([^`]*)`/g, "$1")
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
		.replace(/\s+#+\s*$/, "")
		.trim();
}

/**
 * Every heading in a source file, in document order. Fenced blocks are tracked so a
 * comment opening on `#` inside a shell sample never reads as a heading, which is the
 * one way a line scan differs from a parse on this corpus.
 */
function readHeadings(source: string): Array<{ level: number; text: string }> {
	let headings: Array<{ level: number; text: string }> = [];
	let fence: string | null = null;

	for (let line of withoutFrontmatter(source).split("\n")) {
		let fenceMatch = /^\s*(`{3,}|~{3,})/.exec(line);

		if (fenceMatch?.[1]) {
			let marker = fenceMatch[1][0] ?? "";
			if (fence === null) fence = marker;
			else if (fence === marker) fence = null;
			continue;
		}

		if (fence !== null) continue;

		let heading = /^(#{1,6})\s+(.+)$/.exec(line);
		if (!heading?.[1] || !heading[2]) continue;

		let text = toPlainHeading(heading[2]);
		if (text !== "") headings.push({ level: heading[1].length, text });
	}

	return headings;
}

/**
 * Drops the run of sections a README ends on for npm's sake, matching what the renderer
 * takes off the page: a reader searching for "License" is answered by the page that
 * states the licence once, not by sixty headings that no longer exist.
 */
function withoutBoilerplateTail(
	headings: Array<{ level: number; text: string }>,
): Array<{ level: number; text: string }> {
	let tail = headings.length;

	for (let index = headings.length - 1; index >= 0; index--) {
		let heading = headings[index];
		if (heading?.level !== 2) continue;
		if (!BOILERPLATE_SECTIONS.has(heading.text)) break;
		tail = index;
	}

	return headings.slice(0, tail);
}

/**
 * Gives every heading the fragment the rendered page gives it. The counter runs over all
 * depths, the way the renderer's does, so a repeated `Props` heading is numbered the same
 * here as it is there and a result lands on the section it names.
 */
function withAnchors(headings: Array<{ level: number; text: string }>): ScannedHeading[] {
	let taken = new Map<string, number>();

	return headings.map((heading) => {
		let base = slugify(heading.text);
		let seen = taken.get(base) ?? 0;
		taken.set(base, seen + 1);

		return { ...heading, id: seen === 0 ? base : `${base}-${seen}` };
	});
}

/** The headings a guide offers, which is every one the rendered page keeps. */
function guideHeadings(source: string): ScannedHeading[] {
	return withAnchors(readHeadings(source)).filter((heading) => INDEXED_LEVELS.has(heading.level));
}

/**
 * The headings a package reference offers. The opening `# @sdxc/name` goes, because the
 * page names the package above the body, and the npm tail goes with it — both matching
 * the trims the renderer performs before the anchors are assigned.
 */
function readmeHeadings(source: string): ScannedHeading[] {
	let headings = readHeadings(source);
	if (headings[0]?.level === 1) headings = headings.slice(1);

	return withAnchors(withoutBoilerplateTail(headings)).filter((heading) =>
		INDEXED_LEVELS.has(heading.level),
	);
}

/** The corpus, built once per isolate and reused by every later request. */
let corpus: SearchDocument[] | null = null;

/** The package half of the corpus, lowercased for matching and held under the same rule. */
let packageCorpus: Array<PackageMatch & { haystack: string }> | null = null;

/**
 * The two packages whose page draws a catalogue index in place of its README, so none of
 * the README's headings exists on the page to link to.
 */
const CATALOGUE_DIRECTORIES = new Set(["u", "ui"]);

/**
 * The whole corpus, guides first, packages after and the catalogue pages last, each page
 * followed by its own headings so a result for a page sits above the sections inside it.
 * A catalogue page is one entry, titled by what a reader searches for: the CSS property
 * a utility sets, or a component's or an export's name.
 */
export async function buildSearchIndex(): Promise<SearchDocument[]> {
	if (corpus !== null) return corpus;

	let documents: SearchDocument[] = [];

	for (let section of await listGuides()) {
		for (let guide of section.guides) {
			let href = routes.docs.show.href({ slug: guide.slug });
			let { description, title } = guide.frontmatter;

			documents.push({ href, title, page: title, section: section.title, summary: description });

			let source = await readGuide(guide.slug);
			if (source === null) continue;

			for (let heading of guideHeadings(source)) {
				documents.push({
					href: `${href}#${heading.id}`,
					title: heading.text,
					page: title,
					section: section.title,
				});
			}
		}
	}

	for (let group of listPackageGroups()) {
		let section = `${PACKAGE_SECTION_PREFIX} · ${group.title}`;

		for (let entry of group.packages) {
			let href = routes.api.show.href({ name: entry.directory });

			documents.push({
				href,
				title: entry.name,
				page: entry.name,
				section,
				summary: entry.description,
			});

			if (CATALOGUE_DIRECTORIES.has(entry.directory)) continue;

			let source = await readPackageReadme(entry.directory);
			if (source === null) continue;

			for (let heading of readmeHeadings(source)) {
				documents.push({
					href: `${href}#${heading.id}`,
					title: heading.text,
					page: entry.name,
					section,
				});
			}
		}
	}

	for (let page of await listCataloguePages()) {
		documents.push({
			href: page.href,
			title: page.title,
			page: page.title,
			section: `${page.package} · ${page.section}`,
			summary: page.summary,
		});
	}

	corpus = documents;
	return documents;
}

/**
 * The best answers to a query across the guides, the package references and the
 * catalogue pages.
 *
 * @param query - What was asked for, in a reader's or a model's own words.
 * @param limit - How many results to return.
 * @returns The matching entries, strongest first.
 */
export async function searchDocs(query: string, limit: number): Promise<SearchDocument[]> {
	return rankDocuments(await buildSearchIndex(), query, limit);
}

/**
 * The packages a query could be asking for, matched against the name and description a
 * manifest states and against the README's own text, so "the one for parsing OPML" finds
 * `@sdxc/opml` whether or not the word appears in its one-line description.
 *
 * @param query - What was asked for.
 * @param limit - How many packages to return.
 * @returns The matching packages, the ones named or described first.
 */
export async function searchPackages(query: string, limit: number): Promise<PackageMatch[]> {
	let entries = await buildPackageCorpus();
	let tokens = tokenize(query);

	if (tokens.length === 0) return entries.slice(0, limit).map(toPackageMatch);

	let scored: Array<{ entry: (typeof entries)[number]; score: number; order: number }> = [];

	for (let [order, entry] of entries.entries()) {
		let label = `${entry.name} ${entry.description}`.toLowerCase();
		let total = 0;

		for (let token of tokens) {
			if (includesWord(label, token)) total += NAMED_SCORE;
			else if (includesWord(entry.haystack, token)) total += MENTIONED_SCORE;
			else {
				total = 0;
				break;
			}
		}

		if (total > 0) scored.push({ entry, score: total, order });
	}

	scored.sort((a, b) => b.score - a.score || a.order - b.order);

	return scored.slice(0, limit).map((match) => toPackageMatch(match.entry));
}

/** Drops the matching text a result has no use for, leaving what a caller reads. */
function toPackageMatch(entry: PackageMatch & { haystack: string }): PackageMatch {
	let { haystack: _haystack, ...match } = entry;
	return match;
}

/** Every package with its README folded into one lowercased string to match against. */
async function buildPackageCorpus(): Promise<Array<PackageMatch & { haystack: string }>> {
	if (packageCorpus !== null) return packageCorpus;

	let entries: Array<PackageMatch & { haystack: string }> = [];

	for (let group of listPackageGroups()) {
		for (let entry of group.packages) {
			let readme = (await readPackageReadme(entry.directory)) ?? "";

			entries.push({
				name: entry.name,
				directory: entry.directory,
				description: entry.description,
				href: routes.api.show.href({ name: entry.directory }),
				markdownHref: routes.markdown.package.href({ name: entry.directory }),
				haystack: `${entry.name} ${entry.description} ${group.title} ${readme}`.toLowerCase(),
			});
		}
	}

	packageCorpus = entries;
	return entries;
}
