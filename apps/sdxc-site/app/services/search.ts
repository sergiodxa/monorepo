/**
 * The search corpus: one entry per page, plus one per heading a reader can jump to,
 * across the guides, every package reference and every page of the two catalogues.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Markdown } from "@sdxc/markdown";
import { isFailure } from "@sdxc/result";

import type { Anchor } from "~/app/services/article";
import type { SearchDocument, SearchKind } from "~/app/services/search-query";

import { anchorArticle, anchorPackageReadme, tableOfContents } from "~/app/services/article";
import { listCataloguePages } from "~/app/services/catalogue-pages";
import { listGuides, MARKDOWN_OPTIONS, readGuide } from "~/app/services/docs";
import { listPackageGroups, readPackageReadme } from "~/app/services/packages";
import { includesWord, rankDocuments, tokenize } from "~/app/services/search-query";
import routes from "~/routes/web";

/** How the package half of the corpus is labelled when a result names its section. */
const PACKAGE_SECTION_PREFIX = "Packages";

/** Score for a word in the name or the one-line description, which is what a package is. */
const NAMED_SCORE = 10;

/** Score for a word the README merely uses, which every long README uses many of. */
const MENTIONED_SCORE = 1;

/** Score for a word that is a package's whole name, so `result` finds `@sdxc/result` first. */
const EXACT_NAME_SCORE = 100;

/** What a package search answers with: enough to decide, and the page to read next. */
export interface PackageMatch {
	name: string;
	directory: string;
	description: string;
	href: string;
	/** The page's `.md` twin, which is what an agent reads the package from. */
	markdownHref: string;
}

/** The kind a package's own pages belong to: its catalogue's for `u` and `ui`, else the API. */
function packageKind(directory: string): SearchKind {
	if (directory === "u" || directory === "ui") return directory;
	return "api";
}

/**
 * The headings a guide offers, with the fragments its page renders. A guide the parser
 * or the anchoring rejects renders no page, so it offers no headings either.
 */
function guideHeadings(source: string): Anchor[] {
	let parsed = Markdown.parse(source, MARKDOWN_OPTIONS);
	if (isFailure(parsed)) return [];

	let anchored = anchorArticle(parsed.data.document, MARKDOWN_OPTIONS);
	return isFailure(anchored) ? [] : tableOfContents(anchored.data);
}

/**
 * The headings a package reference offers, after the same trims its page makes: the
 * opening `# @sdxc/name` the page names above the body, and the npm tail.
 */
function readmeHeadings(source: string): Anchor[] {
	let parsed = Markdown.parse(source);
	if (isFailure(parsed)) return [];

	let anchored = anchorPackageReadme(parsed.data.document);
	return isFailure(anchored) ? [] : tableOfContents(anchored.data);
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
 */
export async function buildSearchIndex(): Promise<SearchDocument[]> {
	if (corpus !== null) return corpus;

	let documents: SearchDocument[] = [];

	for (let section of await listGuides()) {
		for (let guide of section.guides) {
			let href = routes.docs.show.href({ slug: guide.slug });
			let { description, title } = guide.frontmatter;

			documents.push({
				href,
				title,
				page: title,
				section: section.title,
				kind: "guide",
				summary: description,
			});

			let source = await readGuide(guide.slug);
			if (source === null) continue;

			for (let heading of guideHeadings(source)) {
				documents.push({
					href: `${href}#${heading.id}`,
					title: heading.text,
					page: title,
					section: section.title,
					kind: "guide",
				});
			}
		}
	}

	for (let group of listPackageGroups()) {
		let section = `${PACKAGE_SECTION_PREFIX} · ${group.title}`;

		for (let entry of group.packages) {
			let href = routes.api.show.href({ name: entry.directory });
			let kind = packageKind(entry.directory);

			documents.push({
				href,
				title: entry.name,
				page: entry.name,
				section,
				kind,
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
					kind,
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
			kind: page.package === "@sdxc/u" ? "u" : "ui",
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
		let bareName = entry.name.replace(/^@[^/]+\//, "").toLowerCase();
		let total = 0;

		for (let token of tokens) {
			if (token === bareName) total += EXACT_NAME_SCORE;
			else if (includesWord(label, token)) total += NAMED_SCORE;
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
