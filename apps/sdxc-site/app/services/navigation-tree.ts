/**
 * The shape of a sidebar tree, and how a page is located inside it. It holds no reader
 * of its own on purpose: a view drawing the tree or the pager imports only this, so the
 * parsers that assemble a tree stay on the server and out of the client bundle the views
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocsTree } from "@sdxc/ui/docs";

/** One destination, titled the way both the sidebar and the pager name it. */
export interface NavEntry {
	title: string;
	href: string;
}

/** A titled run of entries, in the order they are meant to be read. */
export interface NavGroup {
	title: string;
	entries: NavEntry[];
}

/**
 * One labelled band of the sidebar: its own links first, then titled groups a reader can
 * fold away, for a band whose leaves number in the hundreds.
 */
export interface NavSection {
	title: string;
	entries: NavEntry[];
	groups: NavGroup[];
}

/**
 * One sidebar, in the order it is drawn from top to bottom. Each part of the site draws
 * its own, so the pager steps only through the pages of the part being read.
 */
export interface NavTree {
	/** What the tree is announced as, and the first step of the trail on a page outside it. */
	label: string;
	/** The page the tree hangs from, which a reader who is lost inside it is sent back to. */
	href: string;
	sections: NavSection[];
}

/** Every entry in sidebar reading order, which is the order the pager steps through. */
export function flattenNav(tree: NavTree): NavEntry[] {
	return tree.sections.flatMap((section) => [
		...section.entries,
		...section.groups.flatMap((group) => group.entries),
	]);
}

/**
 * The tree in the shape the shared docs sidebar and pager read: a section's own entries
 * first, then each group as an item holding its entries, which is the order both draw.
 */
export function toDocsTree(tree: NavTree): DocsTree {
	return {
		label: tree.label,
		sections: tree.sections.map((section) => ({
			title: section.title,
			items: [
				...section.entries,
				...section.groups.map((group) => ({ title: group.title, items: group.entries })),
			],
		})),
	};
}
