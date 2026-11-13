/**
 * The match rule a file tree's filter applies, shared by the server that renders a narrowed
 * tree for `?filter=` and the island that narrows it as the reader types, so both keep the
 * same files for the same query.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Whether a file's path matches a filter query: every whitespace-separated term appears in
 * the path, ignoring case, so `ui tree` finds `packages/ui/src/app/tree.tsx`. An empty or
 * blank query matches every path.
 *
 * @param path The file's path or name.
 * @param query What the reader typed.
 * @returns Whether the file stays in the tree.
 * @example paths.filter((path) => treeFilterMatches(path, url.searchParams.get("filter") ?? ""))
 */
export function treeFilterMatches(path: string, query: string): boolean {
	let haystack = path.toLowerCase();
	return query
		.toLowerCase()
		.split(/\s+/)
		.filter((term) => term !== "")
		.every((term) => haystack.includes(term));
}
