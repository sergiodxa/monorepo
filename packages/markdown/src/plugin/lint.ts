/**
 * A content linter over a parsed document: code without a language, skipped heading
 * levels, images with no alternative text, empty links, and fragments that point at
 * nothing. Each problem carries the offending node's position, so CI names the line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Markdown } from "../index.js";

import { Slugger } from "../lib/slug.js";
import { toPlainText } from "../plain/index.js";

/** The rules `lint` runs unless `options.rules` turns them off. */
export type LintRule =
	| "code-language"
	| "heading-increment"
	| "single-h1"
	| "image-alt"
	| "empty-link"
	| "broken-anchor"
	| "duplicate-id";

/** One finding. `rule` is the built-in or custom rule name a caller turns off to silence it. */
export interface LintProblem {
	rule: string;
	message: string;
	position: Markdown.Position;
}

/**
 * Records a problem for the rule being run, at the node it was handed unless the rule
 * names a narrower or wider span.
 */
export interface LintReport {
	(message: string, position?: Markdown.Position): void;
}

/** A rule of the caller's own, run once on every node in document order, the document included. */
export interface LintCustomRule {
	(node: Markdown.Node, report: LintReport): void;
}

/** Which rules run, and what the document's fragments may resolve against beyond its own ids. */
export interface LintOptions {
	/** `false` turns a rule off, built-in or custom alike; every rule runs otherwise. */
	rules?: { [rule in LintRule]?: boolean } & Record<string, boolean | undefined>;
	/** Ids the page has outside the document, such as a layout's `#comments`, that a `#fragment` may name. */
	ids?: Iterable<string>;
	/** Extra rules keyed by the name their problems carry. */
	custom?: Record<string, LintCustomRule>;
}

/**
 * Lints a document and returns every problem ordered by where it starts in the source.
 * Problems are data: an empty array means the document passed, and nothing here fails.
 *
 * @param document - A parsed document; its positions are what the problems carry
 * @param options - Rules to turn off, ids known from outside, and custom rules
 * @returns The problems, sorted by start offset
 * @example lint(document, { rules: { "single-h1": false } })
 */
export function lint(document: Markdown.Document, options: LintOptions = {}): LintProblem[] {
	let enabled = (rule: string) => options.rules?.[rule] !== false;
	let problems: LintProblem[] = [];
	let ids = collectIds(document);
	for (let id of options.ids ?? []) ids.known.add(id);

	let previousLevel: number | undefined;
	let seenH1 = false;
	let custom = Object.entries(options.custom ?? {}).filter(([rule]) => enabled(rule));

	/** Records a built-in rule's problem when that rule is on. */
	function report(rule: LintRule, message: string, position: Markdown.Position) {
		if (enabled(rule)) problems.push({ rule, message, position });
	}

	/** Reports a `#fragment` href that resolves to no id; other hrefs belong to other pages. */
	function checkAnchor(href: string, position: Markdown.Position) {
		if (!href.startsWith("#") || href.length === 1) return;
		let fragment = decodeFragment(href.slice(1));
		if (ids.known.has(fragment)) return;
		report(
			"broken-anchor",
			`Link points at #${fragment}, which no heading or block in the document has`,
			position,
		);
	}

	/** Runs every rule on one node, then on its children, so problems follow reading order. */
	function visit(node: Markdown.Node) {
		switch (node.type) {
			case "code":
				if (!node.language) report("code-language", "Code block has no language", node.position);
				break;

			case "heading":
				if (previousLevel !== undefined && node.level > previousLevel + 1) {
					report(
						"heading-increment",
						`Heading level ${node.level} follows level ${previousLevel}; expected level ${previousLevel + 1} or less`,
						node.position,
					);
				}
				previousLevel = node.level;
				if (node.level === 1) {
					if (seenH1)
						report("single-h1", "Document has more than one level-1 heading", node.position);
					seenH1 = true;
				}
				break;

			case "image":
				if (isBlank(node)) report("image-alt", "Image has no alternative text", node.position);
				break;

			case "link":
				if (node.href === "") report("empty-link", "Link has no target", node.position);
				else if (isBlank(node)) report("empty-link", "Link has no text", node.position);
				checkAnchor(node.href, node.position);
				break;

			case "element":
				checkElement(node);
				break;
		}

		for (let [rule, run] of custom) {
			run(node, (message, position = node.position) => {
				problems.push({ rule, message, position });
			});
		}

		if ("children" in node) {
			for (let child of node.children as Markdown.Node[]) visit(child);
		}
	}

	/**
	 * Applies the image and link rules to the `img` and `a` elements an allowlist admits.
	 * An attribute still holding a variable is skipped, since its value is unknown until filled.
	 */
	function checkElement(node: Markdown.Element) {
		if (node.name === "img") {
			let alt = node.attributes.alt;
			if (alt === undefined || (typeof alt === "string" && alt.trim() === "")) {
				report("image-alt", "Image has no alternative text", node.position);
			}
		}

		if (node.name === "a") {
			let href = node.attributes.href;
			if (href === "") report("empty-link", "Link has no target", node.position);
			else if (isBlank(node)) report("empty-link", "Link has no text", node.position);
			if (typeof href === "string") checkAnchor(href, node.position);
		}
	}

	visit(document);

	for (let duplicate of ids.duplicates) {
		report(
			"duplicate-id",
			`Id #${duplicate.id} is already used by an earlier block`,
			duplicate.position,
		);
	}

	return problems.sort((a, b) => a.position.start.offset - b.position.start.offset);
}

/** Every id a fragment may resolve to, and each later block that reused an explicit one. */
interface CollectedIds {
	known: Set<string>;
	duplicates: Array<{ id: string; position: Markdown.Position }>;
}

/**
 * Collects the document's ids the way a renderer assigns them: explicit `id` attributes
 * first, reserved so no slug takes them, then a GitHub slug for each heading without one,
 * from one slugger in document order so repeated headings number as they do on GitHub.
 */
function collectIds(document: Markdown.Document): CollectedIds {
	let known = new Set<string>();
	let duplicates: CollectedIds["duplicates"] = [];
	let unnamed: Markdown.Heading[] = [];

	/** Gathers explicit ids and the headings left for the slugger, in document order. */
	function gather(node: Markdown.Node) {
		let id = "attributes" in node ? node.attributes.id : undefined;
		if (typeof id === "string" && id !== "") {
			if (known.has(id)) duplicates.push({ id, position: node.position });
			known.add(id);
		} else if (node.type === "heading") {
			unnamed.push(node);
		}

		if ("children" in node) {
			for (let child of node.children as Markdown.Node[]) gather(child);
		}
	}

	gather(document);

	let slugger = new Slugger();
	for (let id of known) slugger.reserve(id);
	for (let heading of unnamed) known.add(slugger.next(toPlainText(heading)));

	return { known, duplicates };
}

/**
 * True when a node's children read as empty or whitespace. An image inside a link
 * counts as its text, so a linked badge with alternative text passes.
 */
function isBlank(node: Markdown.Image | Markdown.Link | Markdown.Element): boolean {
	let children: Markdown.Node[] = node.children;
	return children.every((child) => toPlainText(child, { images: true }).trim() === "");
}

/** Percent-decodes a fragment, keeping it as written when the encoding is malformed. */
function decodeFragment(fragment: string): string {
	try {
		return decodeURIComponent(fragment);
	} catch {
		return fragment;
	}
}
