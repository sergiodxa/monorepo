/**
 * How `sdxc make` reads the name argument: a slash is a folder inside the kind's folder, and
 * every segment becomes kebab-case on disk, so `Trials/ExpireOld` and `trials/expire-old`
 * write the same file. The other spellings a stub or a declaration needs derive from it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

/** A parsed name, in each spelling the generator uses. */
export interface Name {
	/** Every segment, kebab-case: the folders inside the kind's folder, then the file. */
	segments: string[];
	/** The last segment: the file's base name. */
	base: string;
	/** The last segment in camelCase, the key a declaration uses. */
	key: string;
	/** The last segment in PascalCase. */
	pascal: string;
	/** The last segment in snake_case, as an MCP tool or a table names it. */
	snake: string;
	/** The last segment as words, the first capitalized: `get-post` reads `Get post`. */
	title: string;
}

/**
 * Parses `input` into its segments. Each segment must start with a letter once spelled in
 * kebab-case, so every derived key is an identifier; an empty, `.` or `..` segment is refused.
 */
export function parseName(input: string): Result<Name, Error> {
	let segments = input.split("/").map(kebab);
	let invalid = segments.find((segment) => !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(segment));
	if (invalid !== undefined) {
		return failure(
			new Error(
				`"${input}" is not a name; use letters, digits and dashes in each segment, starting with a letter`,
			),
		);
	}
	let base = segments[segments.length - 1] ?? "";
	let words = base.split("-");
	return success({
		segments,
		base,
		key: camel(base),
		pascal: words.map(capitalize).join(""),
		snake: words.join("_"),
		title: capitalize(words.join(" ")),
	});
}

/** A kebab-case segment in camelCase: `get-post` reads `getPost`. */
export function camel(segment: string): string {
	let [first = "", ...rest] = segment.split("-");
	return first + rest.map(capitalize).join("");
}

/** `text` in kebab-case, splitting camelCase humps, underscores and spaces. */
function kebab(text: string): string {
	return text
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
		.replace(/[\s_]+/g, "-")
		.toLowerCase();
}

/** `word` with its first letter upper case. */
function capitalize(word: string): string {
	return word.charAt(0).toUpperCase() + word.slice(1);
}
