/**
 * RFC 7644 §3.5.2 PATCH: parse a `PatchOp` body into operations whose paths share the filter
 * grammar, and apply them to a wire-shaped resource as a whole or not at all. Providers'
 * quirks (capitalized `op`, `"True"`/`"False"` strings) are read the way they mean.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Discovery } from "./discovery.js";
import type { Filter } from "./filter.js";

/** Types for PATCH operations. */
export namespace Patch {
	/** RFC 7644 §3.5.2's `PATH = attrPath / valuePath [subAttr]`. */
	export interface Path {
		/** The attribute, with a sub-attribute when written `name.givenName`. */
		attribute: Filter.AttributePath;
		/** The value filter of `emails[type eq "work"]`, applied to each value of the attribute. */
		filter: Filter.Expression | null;
		/** The sub-attribute after a value filter, as in `emails[type eq "work"].value`. */
		subAttribute: string | null;
	}

	/** One entry of `Operations`, with `op` lowercased. */
	export interface Operation {
		op: "add" | "remove" | "replace";
		/** `null` for a path-less `add` or `replace`, whose value is an object of attributes. */
		path: Path | null;
		value: unknown;
	}

	/** What `applyPatch` evaluates operations against. */
	export interface ApplyOptions {
		/** Types, mutability and multi-valuedness of every attribute an operation may touch. */
		definitions: Discovery.Definitions;
	}
}

export { applyPatch } from "./lib/patch/apply.js";
export { parsePatch } from "./lib/patch/parse.js";
