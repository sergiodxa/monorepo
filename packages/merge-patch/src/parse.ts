/**
 * Reads and writes merge patch documents as text. Any JSON value is a valid merge patch,
 * so reading is JSON parsing with a failure a caller can branch on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { JSONValue } from "./json-value.js";

/** Signals that the text of a merge patch is not JSON. */
export class MergePatchParseError extends Error {
	override name = "MergePatchParseError";
}

/**
 * Reads a merge patch document.
 *
 * @param text - The document's JSON text.
 * @returns The patch, or why the text is not JSON.
 */
export function parse(text: string): Result<JSONValue, MergePatchParseError> {
	try {
		return success(JSON.parse(text) as JSONValue);
	} catch (error) {
		let message = error instanceof Error ? error.message : "Invalid JSON";
		return failure(new MergePatchParseError(message, { cause: error }));
	}
}

/**
 * Writes a merge patch document as the JSON text a request body carries.
 *
 * @param patch - The patch, typically from `diff`.
 * @returns The document's JSON text.
 */
export function stringify(patch: JSONValue): string {
	return JSON.stringify(patch);
}
