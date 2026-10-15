/**
 * Rewrites module specifiers in place: the caller maps each reference to a new specifier and
 * only the string literals that changed are replaced, each in its original quote character,
 * so the rest of the file stays byte for byte.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { isFailure } from "@sdxc/result";

import type { Edit, Replacement } from "./edit.js";
import type { CodemodError } from "./errors.js";
import type { FindOptions, ModuleReference } from "./references.js";

import { finish } from "./edit.js";
import { findModuleReferences } from "./references.js";
import { quote } from "./structure.js";

/**
 * `source` with the specifier of every reference `map` answers a string for replaced by that
 * string; `null` (or the same specifier) leaves the reference untouched. `options.calls` adds
 * listed calls such as `vi.mock` to the references `map` sees.
 *
 * @example rewriteSpecifiers("a.ts", source, (ref) => ref.specifier === "x" ? "y" : null)
 */
export function rewriteSpecifiers(
	filename: string,
	source: string,
	map: (reference: ModuleReference) => string | null,
	options: FindOptions = {},
): Result<Edit, CodemodError> {
	let references = findModuleReferences(filename, source, options);
	if (isFailure(references)) return references;
	let replacements: Replacement[] = [];
	for (let reference of references.data) {
		let next = map(reference);
		if (next === null || next === reference.specifier) continue;
		let { start, end } = reference.specifierRange;
		replacements.push({ start, end, text: quote(next, source[start] ?? '"') });
	}
	return finish(filename, source, replacements);
}
