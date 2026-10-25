/**
 * The six RFC 6902 operations as types. A JSON Patch document is an array of them,
 * applied in order; `path` and `from` are RFC 6901 JSON Pointers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { JSONValue } from "./json-value.js";

/**
 * Inserts `value` at `path`: a new object member, an array element shifted in before the
 * index (`-` appends), or the whole document at `""`. An existing member is replaced.
 */
export interface AddOperation {
	op: "add";
	path: string;
	value: JSONValue;
}

/** Removes the member or array element at `path`, which must exist. */
export interface RemoveOperation {
	op: "remove";
	path: string;
}

/** Swaps the value at `path`, which must exist, for `value`. */
export interface ReplaceOperation {
	op: "replace";
	path: string;
	value: JSONValue;
}

/** Removes the value at `from` and adds it at `path`; `path` may not lie inside `from`. */
export interface MoveOperation {
	op: "move";
	from: string;
	path: string;
}

/** Adds a deep copy of the value at `from` at `path`. */
export interface CopyOperation {
	op: "copy";
	from: string;
	path: string;
}

/** Fails the whole patch unless the value at `path` equals `value`. */
export interface TestOperation {
	op: "test";
	path: string;
	value: JSONValue;
}

/** One step of a JSON Patch document. */
export type Operation =
	| AddOperation
	| RemoveOperation
	| ReplaceOperation
	| MoveOperation
	| CopyOperation
	| TestOperation;

/** A JSON Patch document: operations applied in order, all or nothing. */
export type JSONPatch = Operation[];
