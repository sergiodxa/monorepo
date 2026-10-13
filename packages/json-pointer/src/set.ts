/**
 * Writes a value at a JSON Pointer, returning a new tree. Missing parents stay
 * missing: creating them is RFC 6902 `add`, not this assignment.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import { JsonPointerError } from "./error.js";
import { parse } from "./parse.js";
import { arrayIndex, child, MISSING } from "./walk.js";

/**
 * Returns a new document with `value` stored at `pointer`. The empty pointer
 * replaces the document; `undefined` is not a JSON value, so that replacement
 * fails. Intermediate tokens must already resolve, so `/a/b` on `{}` fails.
 *
 * @param document - The tree to copy and update.
 * @param pointer - An RFC 6901 JSON Pointer.
 * @param value - The JSON value to store.
 * @returns The updated tree, or why the write cannot be applied.
 * @example set({ a: 1 }, "/b", 2); // success({ a: 1, b: 2 })
 */
export function set(
	document: unknown,
	pointer: string,
	value: unknown,
): Result<unknown, JsonPointerError> {
	if (value === undefined) {
		return failure(new JsonPointerError("A JSON Pointer cannot be set to a non-value."));
	}

	let tokens = parse(pointer);
	if (isFailure(tokens)) return tokens;
	if (tokens.data.length === 0) return success(structuredClone(value));

	let root = structuredClone(document);
	let parent: unknown = root;
	for (let index = 0; index < tokens.data.length - 1; index++) {
		let next = child(parent, tokens.data[index] as string);
		if (next === MISSING) {
			return failure(
				new JsonPointerError(`JSON Pointer "${pointer}" cannot create a missing parent.`),
			);
		}
		parent = next;
	}

	let last = tokens.data[tokens.data.length - 1] as string;
	if (Array.isArray(parent)) {
		let index = arrayIndex(last);
		if (index === null || index >= parent.length) {
			return failure(new JsonPointerError(`JSON Pointer "${pointer}" does not resolve.`));
		}
		parent[index] = structuredClone(value);
		return success(root);
	}

	if (typeof parent === "object" && parent !== null) {
		writeMember(parent as Record<string, unknown>, last, structuredClone(value));
		return success(root);
	}

	return failure(new JsonPointerError(`JSON Pointer "${pointer}" cannot create a missing parent.`));
}

/**
 * Writes `value` as an own enumerable property so a key named `__proto__` stays
 * data instead of replacing the object's prototype.
 */
function writeMember(object: Record<string, unknown>, key: string, value: unknown): void {
	Object.defineProperty(object, key, {
		value,
		enumerable: true,
		writable: true,
		configurable: true,
	});
}
