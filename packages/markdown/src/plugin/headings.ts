/**
 * A `Markdown.walk` visitor that gives every heading a unique `id` — the author's own,
 * or a GitHub-compatible slug of its text — and a table of contents read back from the
 * walked document, so in-page links and navigation agree on one set of anchors.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Markdown } from "../index.js";

import { slug as githubSlug, Slugger } from "../lib/slug.js";
import { toPlainText } from "../plain/index.js";

/** Every heading level, which is what the visitor gives ids to unless told otherwise. */
const ALL_LEVELS: readonly Markdown.Heading["level"][] = [1, 2, 3, 4, 5, 6];

/** The levels an in-page navigation lists by default; deeper ones are detail inside a section. */
const TOC_LEVELS: readonly Markdown.Heading["level"][] = [2, 3];

/** Which headings the visitor gives ids to, and how it turns their text into one. */
export interface HeadingsOptions {
	/**
	 * The levels that get a generated id. Author ids at every level are kept and reserved.
	 * @default [1, 2, 3, 4, 5, 6]
	 */
	levels?: readonly Markdown.Heading["level"][];
	/**
	 * Turns a heading's plain text into its id; repeated results still take a `-1`, `-2`
	 * suffix. GitHub's slug keeps `#fragment` links copied from GitHub working.
	 */
	slug?: (text: string) => string;
}

/** Which headings a table of contents lists. */
export interface TableOfContentsOptions {
	/** @default [2, 3] */
	levels?: readonly Markdown.Heading["level"][];
}

/** One heading in a table of contents, with the deeper headings of its section nested inside. */
export interface TableOfContentsEntry {
	/** The heading's `id`, the `#fragment` a link to it uses. */
	id: string;
	/** The heading's plain text, inline markup dropped. */
	text: string;
	level: Markdown.Heading["level"];
	children: TableOfContentsEntry[];
}

/**
 * Builds the visitor for one walk. A `document` walk first reserves every author-written
 * id in it, wherever it stands, so a generated slug never takes one; each document walk
 * starts with no ids taken, while a walk from a subtree keeps the ids of earlier ones.
 *
 * @param options - The levels that get ids and the slug function
 * @returns A visitor to pass to `Markdown.walk`, alone or spread beside others
 * @example Markdown.walk(document, headings({ levels: [2, 3] }))
 */
export function headings(options: HeadingsOptions = {}) {
	let levels = new Set(options.levels ?? ALL_LEVELS);
	let toSlug = options.slug ?? githubSlug;
	let slugger = new Slugger();

	/**
	 * The heading's slug, numbered past every id already taken. An empty slug yields
	 * `undefined`, so a heading of punctuation alone goes without an anchor.
	 */
	function claim(heading: Markdown.Heading): string | undefined {
		let base = toSlug(toPlainText(heading));
		if (base === "") return undefined;
		return slugger.claim(base);
	}

	return {
		/** Resets the taken ids to the author ids this document holds. */
		document(node) {
			slugger = new Slugger();
			for (let id of explicitIds(node)) slugger.reserve(id);
			return undefined;
		},
		/**
		 * A heading of a chosen level with no `id` gains one; a heading carrying any `id`,
		 * a variable included, is handed back untouched.
		 */
		heading(node) {
			if (typeof node.attributes.id === "string") {
				slugger.reserve(node.attributes.id);
				return undefined;
			}
			if (node.attributes.id !== undefined || !levels.has(node.level)) return undefined;

			let id = claim(node);
			if (id === undefined) return undefined;
			return { ...node, attributes: { ...node.attributes, id } };
		},
	} satisfies Markdown.Visitor;
}

/**
 * Lists a walked document's headings as a tree: each heading holds the deeper ones that
 * follow it until the next heading at its level or shallower. Ids are read as present,
 * so it runs after `headings()`, and a heading with no string `id` is left out.
 *
 * @param node - The document, or any part of one, to read the headings of
 * @param options - The levels to list
 * @returns The top-level entries, in document order
 * @example tableOfContents(unwrap(Markdown.walk(document, headings())))
 */
export function tableOfContents(
	node: Markdown.Node,
	options: TableOfContentsOptions = {},
): TableOfContentsEntry[] {
	let levels = new Set(options.levels ?? TOC_LEVELS);
	let root: TableOfContentsEntry[] = [];
	let open: TableOfContentsEntry[] = [];

	for (let heading of headingsIn(node)) {
		let id = heading.attributes.id;
		if (typeof id !== "string" || !levels.has(heading.level)) continue;

		let entry: TableOfContentsEntry = {
			id,
			text: toPlainText(heading),
			level: heading.level,
			children: [],
		};

		while (open.length > 0 && (open.at(-1)?.level ?? 0) >= heading.level) open.pop();
		let parent = open.at(-1);
		if (parent) parent.children.push(entry);
		else root.push(entry);
		open.push(entry);
	}

	return root;
}

/**
 * Every id an author wrote on any node under this one, since an id is unique across the
 * page whichever block carries it.
 *
 * @yields Each explicit string id, depth first
 */
function* explicitIds(node: Markdown.Node): Generator<string> {
	if ("attributes" in node && typeof node.attributes.id === "string") yield node.attributes.id;
	if (!("children" in node)) return;
	for (let child of node.children) yield* explicitIds(child);
}

/**
 * Every heading under a node in document order, the node itself included, nested ones
 * inside blockquotes, list items and tags as well as top-level ones.
 *
 * @yields Each heading, depth first
 */
function* headingsIn(node: Markdown.Node): Generator<Markdown.Heading> {
	if (node.type === "heading") {
		yield node;
		return;
	}
	if (!("children" in node)) return;
	for (let child of node.children) yield* headingsIn(child);
}
