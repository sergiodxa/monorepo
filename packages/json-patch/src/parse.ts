/**
 * Reads and writes JSON Patch documents as text: parsing is JSON parsing followed by
 * validation, so a request body becomes typed operations or one failure to answer with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure } from "@sdxc/result";

import type { Operation } from "./operation.js";

import { JsonPatchError } from "./error.js";
import { validate } from "./validate.js";

/**
 * Reads a JSON Patch document. Text that is not JSON and JSON that is not a patch both
 * fail with reason `"invalid-patch"`, the 400 case of RFC 5789.
 *
 * @param text - The document's JSON text.
 * @returns The operations, or why the text is not a patch.
 * @example parse('[{"op":"remove","path":"/a"}]'); // success([{ op: "remove", path: "/a" }])
 */
export function parse(text: string): Result<Operation[], JsonPatchError> {
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch (error) {
		let message = error instanceof Error ? error.message : "Invalid JSON";
		return failure(new JsonPatchError("invalid-patch", null, message));
	}
	return validate(value);
}

/**
 * Writes a patch as the JSON text a request body carries.
 *
 * @param patch - The operations, typically from `diff`.
 * @returns The document's JSON text.
 */
export function stringify(patch: readonly Operation[]): string {
	return JSON.stringify(patch);
}
