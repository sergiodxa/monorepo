/**
 * Writes a node's location as an RFC 9535 normalized path (section 2.7), the one canonical
 * query that selects exactly that node, so two nodes compare by path string alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The escape character, kept out of string escapes so the escape table reads plainly. */
const BACKSLASH = String.fromCharCode(0x5c);

/** The two-character escapes a normalized path uses instead of a hex escape. */
const SHORT_ESCAPES: Record<number, string> = {
	0x08: "b",
	0x09: "t",
	0x0a: "n",
	0x0c: "f",
	0x0d: "r",
	0x27: "'",
	0x5c: BACKSLASH,
};

/**
 * The normalized path of a location: `$`, then `['name']` for each member and `[index]` for
 * each array element, with `'`, `\` and control characters escaped as section 2.7 requires.
 *
 * @param location - Member names and array indexes from the root, outermost first.
 * @returns The path, `"$"` for the root.
 * @example normalizedPath(["store", "book", 0]); // "$['store']['book'][0]"
 */
export function normalizedPath(location: readonly (string | number)[]): string {
	let path = "$";
	for (let segment of location) {
		path += typeof segment === "number" ? `[${segment}]` : `['${escapeName(segment)}']`;
	}
	return path;
}

/** A member name with the characters a single-quoted normalized name cannot hold escaped. */
function escapeName(name: string): string {
	let out = "";
	for (let char of name) {
		let code = char.codePointAt(0) as number;
		let short = SHORT_ESCAPES[code];
		if (short !== undefined) out += BACKSLASH + short;
		else if (code < 0x20) out += `${BACKSLASH}u${code.toString(16).padStart(4, "0")}`;
		else out += char;
	}
	return out;
}
