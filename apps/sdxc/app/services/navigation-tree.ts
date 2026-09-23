/**
 * The shape of the documentation tree, and how a page is located inside it. It holds
 * no reader of its own on purpose: a view drawing the tree or the pager imports only
 * this, so the parsers that assemble the tree stay on the server and out of the
 * client bundle the views are collected into.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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

/** The whole tree, in the order the sidebar draws it from top to bottom. */
export interface NavTree {
	guides: NavGroup[];
	packages: NavGroup[];
	/** The `@sdxc/u` catalogue, under the subpath each utility is imported from. */
	utilities: NavGroup[];
	/**
	 * The `@sdxc/ui` catalogue as one list. Their names share a flat namespace and carry no
	 * grouping worth drawing — banding them under their initial adds a row to open before
	 * every row a reader wanted.
	 */
	components: NavEntry[];
}

/** Every entry in sidebar reading order, which is the order the pager steps through. */
export function flattenNav(tree: NavTree): NavEntry[] {
	let grouped = [...tree.guides, ...tree.packages, ...tree.utilities].flatMap(
		(group) => group.entries,
	);

	return [...grouped, ...tree.components];
}

/**
 * The entries either side of the page being read, crossing group boundaries so the
 * whole tree is one run. A path the tree has no entry for — the hub, the package
 * index — sits outside that run, and reports neither neighbour.
 */
export function findNeighbours(
	tree: NavTree,
	activePath: string,
): { previous: NavEntry | null; next: NavEntry | null } {
	let entries = flattenNav(tree);
	let index = entries.findIndex((entry) => entry.href === activePath);

	if (index === -1) return { previous: null, next: null };

	return { previous: entries[index - 1] ?? null, next: entries[index + 1] ?? null };
}
