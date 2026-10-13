/**
 * Writes path segments as an RFC 6901 JSON Pointer, escaping `~` and `/` so a
 * member name holding either still names itself after a round trip through parse.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Formats `segments` as a JSON Pointer. The empty list is the document root,
 * `""`. Each segment becomes `/` plus its escaped text; numbers are `String()`'d
 * so `0` and `"0"` select the same array index.
 *
 * @param segments - Member names and array indexes, outermost first.
 * @returns The pointer, `""` when `segments` is empty.
 * @example stringify(["a/b", "m~n"]); // "/a~1b/m~0n"
 */
export function stringify(segments: readonly (string | number)[]): string {
	let pointer = "";
	for (let segment of segments) {
		pointer += `/${String(segment).replaceAll("~", "~0").replaceAll("/", "~1")}`;
	}
	return pointer;
}
