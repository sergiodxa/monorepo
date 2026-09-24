/**
 * The RFC 7644 §3.4.2.2 filter grammar: parse filter text to an AST, write it back, and
 * compile it to a predicate over wire-shaped resources that honors each attribute's type
 * and `caseExact`. PATCH paths share this module's path grammar.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Discovery } from "./discovery.js";

/** Types for filter expressions and attribute paths. */
export namespace Filter {
	/** `[URN ":"] attribute ["." subAttribute]`, as RFC 7644 §3.10 writes attribute notation. */
	export interface AttributePath {
		/** The URN prefix when the path was written fully qualified, otherwise `null`. */
		schema: string | null;
		attribute: string;
		subAttribute: string | null;
	}

	/** The comparison operators of RFC 7644 Table 3, lowercased whatever the client wrote. */
	export type Operator = "eq" | "ne" | "co" | "sw" | "ew" | "gt" | "ge" | "lt" | "le";

	/** A comparison value: a JSON string, number, boolean or `null`. */
	export type Value = string | number | boolean | null;

	/** A comparison such as `userName eq "bjensen"`. */
	export interface Compare {
		kind: "compare";
		path: AttributePath;
		operator: Operator;
		value: Value;
	}

	/** An `attribute pr` presence test. */
	export interface Present {
		kind: "present";
		path: AttributePath;
	}

	/** Two expressions joined by `and` or `or`. */
	export interface Logical {
		kind: "and" | "or";
		left: Expression;
		right: Expression;
	}

	/** A negated group, `not (...)`. */
	export interface Not {
		kind: "not";
		expression: Expression;
	}

	/** A filter over a multi-valued attribute's values, `emails[type eq "work"]`. */
	export interface ValuePath {
		kind: "valuePath";
		path: AttributePath;
		/** Paths inside are relative to one value of `path`. */
		filter: Expression;
	}

	/** A parsed filter. */
	export type Expression = Compare | Present | Logical | Not | ValuePath;

	/** What `compileFilter` evaluates against. */
	export interface CompileOptions {
		/** Attribute definitions: type, `caseExact` and multi-valuedness for every path. */
		definitions: Discovery.Definitions;
		/**
		 * Paths callers may filter on, such as `userName` or `emails.value`; a filter naming
		 * any other path is `invalidFilter`. Every defined path is allowed when omitted.
		 */
		allow?: string[];
	}
}

export { compileFilter } from "./lib/filter/compile.js";
export { parseFilter, parsePath } from "./lib/filter/parse.js";
export { stringifyFilter, stringifyPath } from "./lib/filter/stringify.js";
