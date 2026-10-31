/**
 * The shape of a docs sidebar, and how a page is located inside it: a tree of sections
 * holding pages and titled groups of pages. The sidebar draws it and the pager steps
 * through it, so both always agree on the reading order.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * One docs sidebar in the order it is drawn, top to bottom. A site with several parts
 * builds one tree per part, so the pager walks only the part being read.
 */
export interface DocsTree {
	/** What the tree is announced as, for the navigation landmark that draws it. */
	label: string;
	sections: DocsTree.Section[];
}

/**
 * Types for {@link DocsTree} and the helpers that walk it.
 */
export namespace DocsTree {
	/** A labelled band of the sidebar; its title is the label a pager shows on crossing into it. */
	export interface Section {
		title: string;
		items: Item[];
	}

	/**
	 * A page (`href`) or a titled group of pages (`items`). A group with an `href` is also a
	 * page of its own, read before its children.
	 */
	export interface Item {
		title: string;
		href?: string;
		/** Short marker drawn beside the title, such as "New" or "Beta". */
		badge?: string;
		items?: Item[];
	}

	/** One page in reading order, with the title of the section it sits in. */
	export interface Page {
		title: string;
		href: string;
		section: string;
	}

	/** Options for {@link findNeighbours}. */
	export interface NeighbourOptions {
		/**
		 * `"section"` keeps the pager inside the current page's section, so a section's last
		 * page offers no next page; `"none"` reads the whole tree as one run.
		 * @default "none"
		 */
		boundary?: "section" | "none";
	}

	/** The pages either side of the one being read; an end of the run is `null`. */
	export interface Neighbours {
		previous: Page | null;
		next: Page | null;
	}
}

/**
 * Every page in sidebar reading order, groups' pages inline where the group sits. This is
 * the order the pager steps through.
 *
 * @param tree The sidebar to read.
 * @returns Each page with the title of its section.
 * @example
 * flattenDocsTree(tree).map((page) => page.href);
 */
export function flattenDocsTree(tree: DocsTree): DocsTree.Page[] {
	return tree.sections.flatMap((section) => flattenItems(section.items, section.title));
}

/**
 * Pages of one section's items, depth first, each group's own page before its children.
 */
function flattenItems(items: DocsTree.Item[], section: string): DocsTree.Page[] {
	return items.flatMap((item) => {
		let own: DocsTree.Page[] = item.href ? [{ title: item.title, href: item.href, section }] : [];
		return item.items ? [...own, ...flattenItems(item.items, section)] : own;
	});
}

/**
 * The pages before and after `path` in reading order. A path the tree has no page for
 * reports neither neighbour; with `boundary: "section"` a neighbour in another section is
 * `null`, so the pager never wraps into an unrelated part of the docs.
 *
 * @param tree The sidebar to walk.
 * @param path The `href` of the page being read, matched exactly.
 * @param options Where the run stops.
 * @returns The previous and next pages, each with its section title.
 * @example
 * let { previous, next } = findNeighbours(tree, "/docs/install", { boundary: "section" });
 */
export function findNeighbours(
	tree: DocsTree,
	path: string,
	options: DocsTree.NeighbourOptions = {},
): DocsTree.Neighbours {
	let pages = flattenDocsTree(tree);
	let index = pages.findIndex((page) => page.href === path);
	if (index === -1) return { previous: null, next: null };

	let current = pages[index];
	let previous = pages[index - 1] ?? null;
	let next = pages[index + 1] ?? null;

	if (options.boundary === "section") {
		if (previous && previous.section !== current?.section) previous = null;
		if (next && next.section !== current?.section) next = null;
	}

	return { previous, next };
}
