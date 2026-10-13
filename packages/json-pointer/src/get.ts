/**
 * Resolves a JSON Pointer against a document, failing when a token has nowhere
 * to land rather than answering `undefined` for a missing path.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import { JsonPointerError } from "./error.js";
import { parse } from "./parse.js";
import { child, MISSING } from "./walk.js";

/**
 * Walks `document` along `pointer`. The empty pointer is the document itself.
 * A missing member, an out-of-range array index, or a token through a scalar
 * is a failure, so callers do not confuse an absent path with a `null` value.
 *
 * @param document - The value the pointer is evaluated against.
 * @param pointer - An RFC 6901 JSON Pointer.
 * @returns The selected value, or why the pointer does not resolve.
 * @example get({ "a/b": 1 }, "/a~1b"); // success(1)
 */
export function get(document: unknown, pointer: string): Result<unknown, JsonPointerError> {
	let tokens = parse(pointer);
	if (isFailure(tokens)) return tokens;

	let current: unknown = document;
	for (let token of tokens.data) {
		let next = child(current, token);
		if (next === MISSING) {
			return failure(new JsonPointerError(`JSON Pointer "${pointer}" does not resolve.`));
		}
		current = next;
	}
	return success(current);
}
