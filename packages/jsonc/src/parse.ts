/**
 * JSONC parsing: the same-length stripping pass, then `JSON.parse` for the value, so accepted
 * input and the values it produces are exactly what `JSON.parse` gives, while a failure carries
 * a line and column of this package's own computing that read the same on every engine.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { Issue } from "./strip.js";

import { check } from "./check.js";
import { JSONCParseError } from "./errors.js";
import { scan } from "./strip.js";

/**
 * The value JSONC `text` holds. Comments and trailing commas are accepted; JSON5 extensions
 * (unquoted keys, single quotes, hexadecimal numbers) are not, and a block comment that never
 * closes is a failure even when the text before it is complete.
 *
 * @example
 * let parsed = parse('{ "port": 8080, // dev only\n}');
 * if (isSuccess(parsed)) parsed.data; // { port: 8080 }
 */
export function parse(text: string): Result<unknown, JSONCParseError> {
	let scanned = scan(text);
	if (scanned.issue !== null) return failure(toError(text, scanned.issue));
	try {
		return success(JSON.parse(scanned.text));
	} catch (error) {
		let found = check(scanned.text) ?? {
			offset: 0,
			reason: error instanceof Error ? error.message : String(error),
		};
		return failure(toError(text, found));
	}
}

/** Turns an offset into the 1-based line and column a user's editor shows for it. */
function toError(text: string, found: Issue): JSONCParseError {
	let line = 1;
	let lineStart = 0;
	for (let index = 0; index < found.offset && index < text.length; index += 1) {
		let char = text[index];
		if (char === "\n" || (char === "\r" && text[index + 1] !== "\n")) {
			line += 1;
			lineStart = index + 1;
		}
	}
	return new JSONCParseError(found.reason, found.offset, line, found.offset - lineStart + 1);
}
