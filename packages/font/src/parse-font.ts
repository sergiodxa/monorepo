/**
 * `parseFont` turns font file bytes into a `Font`. It recognizes the container from the
 * file's signature and hands a bare sfnt to `openSfnt`, so every container a browser accepts
 * ends in the same `Font`, and one it cannot open here names where to go instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure } from "@sdxc/result";

import type { Font } from "./font.js";

import { dfontFonts } from "./dfont.js";
import { FontError } from "./font-error.js";
import { Reader } from "./reader.js";
import { openSfnt } from "./sfnt.js";
import { decodeWoff } from "./woff.js";

/** The first four bytes of every single-font container this package recognizes. */
const SIGNATURES = new Set(["\0\u0001\0\0", "true", "OTTO", "wOFF", "wOF2", "ttcf"]);

/**
 * Reads a TrueType or OpenType font (`.ttf`, `.otf`) or a WOFF web font (`.woff`).
 *
 * @param bytes - The whole font file.
 * @returns The font, or a `FontError` whose `code` is `unsupported` for a container this
 *   entry point does not open (its message names the one that does: `parseFontCollection`
 *   for `.ttc` and `.dfont`, `@sdxc/font/woff2` for `.woff2`), `missing-table`, or
 *   `malformed`.
 * @example let result = parseFont(await file.arrayBuffer());
 */
export function parseFont(bytes: Uint8Array | ArrayBuffer): Result<Font, FontError> {
	return openFont(new Reader(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)));
}

/**
 * Opens the single font a file holds, whatever container wraps it.
 *
 * @param reader - The whole file.
 */
export function openFont(reader: Reader): Result<Font, FontError> {
	if (reader.length < 12) {
		return failure(new FontError("malformed", "The file is too short to be a font."));
	}
	let signature = reader.tag(0);
	if (signature === "wOFF") {
		let sfnt = decodeWoff(reader);
		if (isFailure(sfnt)) return sfnt;
		return openSfnt(new Reader(sfnt.data), 0);
	}
	if (signature === "wOF2") {
		return failure(
			new FontError(
				"unsupported",
				"WOFF2 fonts open through @sdxc/font/woff2: parseWoff2, or decodeWoff2 then parseFont.",
			),
		);
	}
	if (signature === "ttcf" || (!hasFontSignature(reader) && dfontFonts(reader) !== null)) {
		return failure(
			new FontError(
				"unsupported",
				"The file is a font collection; open it with parseFontCollection.",
			),
		);
	}
	return openSfnt(reader, 0);
}

/**
 * Whether the file starts with an sfnt, WOFF, WOFF2 or collection signature, which rules
 * out reading it as a Mac resource fork.
 *
 * @param reader - The whole file.
 */
export function hasFontSignature(reader: Reader): boolean {
	return SIGNATURES.has(reader.tag(0));
}
