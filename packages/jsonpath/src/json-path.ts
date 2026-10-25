/**
 * A parsed RFC 9535 JSONPath query, checked once and applied to any number of documents,
 * returning each selected value with its normalized path.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { isFailure, success } from "@sdxc/result";

import type { JSONValue, Query } from "./ast.js";
import type { JsonPathSyntaxError } from "./error.js";

import { evaluate } from "./evaluate.js";
import { normalizedPath } from "./normalized-path.js";
import { parseQuery } from "./parse.js";

/** One selected value and where it sits in the document. */
export interface JsonPathNode {
	value: JSONValue;
	/** Member names and array indexes from the root, ready for a JSON Pointer. */
	location: (string | number)[];
	/** The normalized path, such as `$['store']['book'][0]`. */
	path: string;
}

/** A well-formed, well-typed query; its construction is the only place a query can fail. */
export class JSONPath {
	/** The query text it was parsed from. */
	readonly source: string;

	readonly #query: Query;

	private constructor(source: string, query: Query) {
		this.source = source;
		this.#query = query;
	}

	/**
	 * Parses a query, rejecting anything RFC 9535 does: bad syntax, whitespace around the
	 * query, an integer outside ±(2^53 − 1), an unknown function or an ill-typed argument.
	 *
	 * @param source - The query text, starting with `$`.
	 * @returns The query, or where and why it is invalid.
	 * @example JSONPath.parse("$.store.book[?@.price < 10].title");
	 */
	static parse(source: string): Result<JSONPath, JsonPathSyntaxError> {
		let query = parseQuery(source);
		if (isFailure(query)) return query;
		return success(new JSONPath(source, query.data));
	}

	/**
	 * The nodes the query selects from `document`, in the order section 2 defines. Object
	 * members are visited in the order the object holds them.
	 *
	 * @param document - The JSON value `$` names.
	 */
	select(document: JSONValue): JsonPathNode[] {
		return evaluate(this.#query, document, document).map(({ value, location }) => ({
			value,
			location,
			path: normalizedPath(location),
		}));
	}

	/**
	 * The selected values alone.
	 *
	 * @param document - The JSON value `$` names.
	 */
	values(document: JSONValue): JSONValue[] {
		return evaluate(this.#query, document, document).map((node) => node.value);
	}
}

/**
 * Parses `source` and selects from `document` in one call, for a query used once.
 *
 * @param document - The JSON value `$` names.
 * @param source - The query text.
 * @returns The selected nodes, or why the query is invalid.
 * @example query({ a: [1, 2] }, "$.a[-1]"); // success([{ value: 2, location: ["a", 1], path: "$['a'][1]" }])
 */
export function query(
	document: JSONValue,
	source: string,
): Result<JsonPathNode[], JsonPathSyntaxError> {
	let parsed = JSONPath.parse(source);
	if (isFailure(parsed)) return parsed;
	return success(parsed.data.select(document));
}
