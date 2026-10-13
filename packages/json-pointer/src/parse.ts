/**
 * Reads an RFC 6901 JSON Pointer into unescaped path segments, so get and set
 * walk a document with the member names the pointer named.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import { JsonPointerParseError } from "./error.js";

/** A `~` that is not the start of `~0` or `~1`, which RFC 6901 forbids. */
const INVALID_ESCAPE = /~(?![01])/u;

/**
 * Reads a JSON Pointer into its reference tokens, unescaping `~1` to `/` then
 * `~0` to `~` so `"~01"` becomes `"~1"`. The empty string is the root, `[]`.
 *
 * @param pointer - The pointer text.
 * @returns The tokens, or why the string is not a JSON Pointer.
 * @example parse("/a~1b/m~0n"); // success(["a/b", "m~n"])
 */
export function parse(pointer: string): Result<string[], JsonPointerParseError> {
	if (pointer === "") return success([]);
	if (!pointer.startsWith("/")) {
		return failure(new JsonPointerParseError("A JSON Pointer must be empty or start with '/'."));
	}
	if (INVALID_ESCAPE.test(pointer)) {
		return failure(new JsonPointerParseError("A JSON Pointer escape must be ~0 or ~1."));
	}

	let tokens: string[] = [];
	for (let encoded of pointer.slice(1).split("/")) {
		tokens.push(encoded.replaceAll("~1", "/").replaceAll("~0", "~"));
	}
	return success(tokens);
}
