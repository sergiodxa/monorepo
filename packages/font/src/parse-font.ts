/**
 * `parseFont` turns font file bytes into a `Font`. It recognizes the container from the
 * file's signature and hands a bare sfnt to `openSfnt`, so every container a browser accepts
 * ends in the same `Font`, and one it cannot open here names where to go instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure } from "@sdxc/result";

import type { Font } from "./font.js";

import { FontError } from "./font-error.js";
import { Reader } from "./reader.js";
import { openSfnt } from "./sfnt.js";

/**
 * Reads a TrueType or OpenType font (`.ttf`, `.otf`).
 *
 * @param bytes - The whole font file.
 * @returns The font, or a `FontError` whose `code` is `unsupported` for a container this
 *   entry point does not open (its message names the one that does), `missing-table`, or
 *   `malformed`.
 * @example let result = parseFont(await file.arrayBuffer());
 */
export function parseFont(bytes: Uint8Array | ArrayBuffer): Result<Font, FontError> {
	let reader = new Reader(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
	if (reader.length < 12) {
		return failure(new FontError("malformed", "The file is too short to be a font."));
	}
	let signature = reader.tag(0);
	if (signature === "ttcf") {
		return failure(new FontError("unsupported", "Font collections (ttcf) are not supported."));
	}
	return openSfnt(reader, 0);
}
