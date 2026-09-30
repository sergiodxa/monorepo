/**
 * Writes a path as the bracket-syntax field name `parse` reads back into that path, so a form
 * names its inputs, and places a schema issue on its input, from the same segments.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One path segment, in either form a Standard Schema issue carries it. */
export type PathSegment = PropertyKey | { readonly key: PropertyKey };

/**
 * Writes the first segment as the root and every later one in brackets.
 *
 * @param path - The segments, from a schema issue or written by hand
 * @returns The field name, or `""` for an empty path
 * @example fieldName(["items", 0, "quantity"]) // "items[0][quantity]"
 * @example fieldName(issue.path ?? [])
 */
export function fieldName(path: ReadonlyArray<PathSegment>): string {
	let [root, ...rest] = path.map((segment) =>
		String(typeof segment === "object" ? segment.key : segment),
	);
	if (root === undefined) return "";
	return root + rest.map((segment) => `[${segment}]`).join("");
}
