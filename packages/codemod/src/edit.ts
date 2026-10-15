/**
 * The result every edit answers and the one place replacements are applied. Applying them by
 * source range is what keeps the rest of a file byte for byte, and re-scanning the output is
 * what keeps an edit from handing back source that no longer scans.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { ModuleReference } from "./references.js";

import { CodemodError } from "./errors.js";
import { tokenize } from "./tokenize.js";

/** What an edit produced. */
export interface Edit {
	/** The edited source, identical to the input when nothing `changed`. */
	source: string;
	changed: boolean;
	/**
	 * References the edit matched but could not change, such as a default or namespace import
	 * `moveImports` cannot split by name; always empty for the insertions.
	 */
	unhandled: ModuleReference[];
}

/** Text that takes the place of `source.slice(start, end)`; an insertion has `start === end`. */
export interface Replacement {
	start: number;
	end: number;
	text: string;
}

/**
 * Applies `replacements` to `source` and checks that the output still scans. Replacements may
 * arrive in any order; two insertions at one offset keep the order they were given in.
 */
export function finish(
	filename: string,
	source: string,
	replacements: Replacement[],
	unhandled: ModuleReference[] = [],
): Result<Edit, CodemodError> {
	let ordered = replacements
		.map((replacement, index) => ({ replacement, index }))
		.sort((a, b) => a.replacement.start - b.replacement.start || a.index - b.index)
		.map(({ replacement }) => replacement);
	let output = "";
	let cursor = 0;
	for (let replacement of ordered) {
		output += source.slice(cursor, replacement.start) + replacement.text;
		cursor = Math.max(cursor, replacement.end);
	}
	output += source.slice(cursor);
	let changed = output !== source;
	if (changed) {
		let scanned = tokenize(filename, output);
		if (isFailure(scanned)) {
			return failure(
				new CodemodError(
					"invalid-output",
					filename,
					`the edit produced source that does not scan (${scanned.error.message})`,
				),
			);
		}
	}
	return success({ source: output, changed, unhandled });
}
