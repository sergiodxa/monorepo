/**
 * The one pass every long-form page runs its parsed markdown through, and the
 * traversals that read the result. Visitors are plain objects, so the anchor, the
 * counted holes, the syntax painting and — for a package README — the link rewriting
 * all merge into a single walk rather than four passes over the same tree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MarkdownWalkError } from "@sdxc/markdown";
import type { Result } from "@sdxc/result";

import { highlight } from "@sdxc/highlight/markdown";
import { Markdown } from "@sdxc/markdown";
import { toPlainText } from "@sdxc/markdown/plain";

import { findPackage, readPackageFacts } from "~/app/services/packages";
import { listShowcase } from "~/app/services/showcase";
import routes from "~/routes/web";

/** Where a file in the workspace is read on GitHub, which is where a README's own links point. */
const SOURCE_BASE = "https://github.com/sergiodxa/monorepo/blob/main/";

/** Heading depths the in-page nav offers; deeper ones are detail inside a section. */
const NAVIGABLE_LEVELS = new Set([2, 3]);

/** The sections a README closes with for npm's sake, which this site frames or states elsewhere. */
export const BOILERPLATE_SECTIONS = new Set(["Versioning", "License", "Author"]);

/** One entry of a page's in-page navigation. */
export interface Anchor {
	id: string;
	text: string;
	level: number;
}

/**
 * The totals the extractor counts on disk beside the catalogues it reads, so a sentence
 * quoting them is counted from the same run that built their pages.
 */
const extractedCounts = import.meta.glob<{ utilities: number; components: number; rfcs: number }>(
	"../generated/counts.json",
	{ eager: true, import: "default" },
);

/** Numbers the copy quotes, written as `{% $name %}` holes so a claim is counted. */
function contentVariables(): Record<string, string> {
	let facts = readPackageFacts();
	let extracted = Object.values(extractedCounts)[0];

	return {
		packageCount: String(facts.published),
		standaloneCount: String(facts.standalone),
		frameworkFreeCount: String(facts.frameworkFree),
		remixCount: String(facts.remixTargeted),
		applicationCount: String(listShowcase().length),
		...(extracted
			? {
					componentCount: String(extracted.components),
					utilityCount: String(extracted.utilities),
					rfcCount: String(extracted.rfcs),
				}
			: {}),
	};
}

/** The fragment a heading is linked to, derived from what the heading reads as. */
export function slugify(text: string): string {
	return (
		text
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "section"
	);
}

/**
 * Gives every heading an `id` to be linked to, keeping a repeated heading — `Props`
 * appears a dozen times in some READMEs — addressable by suffixing the ones after the
 * first. The counter lives per document, so two pages never influence each other.
 */
function headingAnchor(): (node: Markdown.Heading) => Markdown.Heading {
	let taken = new Map<string, number>();

	return (node) => {
		if (typeof node.attributes.id === "string") return node;

		let base = slugify(toPlainText(node));
		let seen = taken.get(base) ?? 0;
		taken.set(base, seen + 1);

		let id = seen === 0 ? base : `${base}-${seen}`;
		return { ...node, attributes: { ...node.attributes, id } };
	};
}

/**
 * Where a README's own link lands on this site. The same file is read on npm, on
 * GitHub and here, so a link to a sibling package resolves to that package's page
 * while anything else in the repository resolves to the file on GitHub.
 */
function rewriteHref(href: string, directory: string): string {
	let sibling = href.startsWith("https://www.npmjs.com/package/@sdxc/")
		? href.slice("https://www.npmjs.com/package/@sdxc/".length)
		: href.startsWith("/packages/")
			? href.slice("/packages/".length)
			: null;

	if (sibling !== null && findPackage(sibling) !== null) {
		return routes.api.show.href({ name: sibling });
	}

	if (href.startsWith("/")) return new URL(href.slice(1), SOURCE_BASE).href;
	if (href.startsWith("./") || href.startsWith("../")) {
		return new URL(href, `${SOURCE_BASE}packages/${directory}/`).href;
	}

	return href;
}

/**
 * Prepares a page written for this site: the counted holes resolved, every heading
 * addressable, and code painted. A hole with no number behind it throws, because a
 * sentence quoting a count the manifests cannot supply is a sentence to fix.
 */
export function prepareArticle(
	document: Markdown.Document,
): Result<Markdown.Document, MarkdownWalkError> {
	let variables = contentVariables();
	let anchor = headingAnchor();

	return Markdown.walk(document, {
		...highlight,
		heading: anchor,
		variable(node) {
			let value = variables[node.name];
			if (value === undefined) throw new Error(`Unresolved variable ${node.name}`);
			return { type: "text", value, position: node.position };
		},
	});
}

/**
 * Drops the opening `# @sdxc/name` a README written for npm has to carry, because the
 * page already names the package above the body. A README that opens on prose instead
 * is returned untouched, and a later level-one heading is a section of the document.
 */
function withoutTitle(document: Markdown.Document): Markdown.Document {
	let [first] = document.children;
	if (first?.type !== "heading" || first.level !== 1) return document;
	return { ...document, children: document.children.slice(1) };
}

/**
 * Drops the run of sections a README ends on for npm's sake: the release scheme, the
 * licence and the author, all of which the page around the README carries instead. One
 * of those names earlier in a file titles a real section, so the scan stops above it.
 */
function withoutBoilerplateTail(document: Markdown.Document): Markdown.Document {
	let children = document.children;
	let tail = children.length;

	for (let index = children.length - 1; index >= 0; index--) {
		let node = children[index];
		if (node?.type !== "heading" || node.level !== 2) continue;
		if (!BOILERPLATE_SECTIONS.has(toPlainText(node).trim())) break;
		tail = index;
	}

	if (tail === children.length) return document;
	return { ...document, children: children.slice(0, tail) };
}

/**
 * Prepares a package's own README: the same anchors and painting, the npm boilerplate
 * trimmed off both ends, and the link rewriting that turns a file written for npm into
 * a page of this site. The trims run first, so the headings they take never reach a walk.
 */
export function preparePackageReadme(
	document: Markdown.Document,
	directory: string,
): Result<Markdown.Document, MarkdownWalkError> {
	let anchor = headingAnchor();

	return Markdown.walk(withoutBoilerplateTail(withoutTitle(document)), {
		...highlight,
		heading: anchor,
		link(node) {
			let href = rewriteHref(node.href, directory);
			if (href === node.href) return;
			return { ...node, href };
		},
	});
}

/**
 * The headings a reader can jump to, read off a prepared document. The handler
 * returns nothing, so the walk changes not one node and serves purely as a read.
 */
export function tableOfContents(document: Markdown.Document): Anchor[] {
	let anchors: Anchor[] = [];

	Markdown.walk(document, {
		heading(node) {
			if (!NAVIGABLE_LEVELS.has(node.level)) return;
			let id = node.attributes.id;
			if (typeof id !== "string") return;
			anchors.push({ id, text: toPlainText(node), level: node.level });
		},
	});

	return anchors;
}
