/**
 * The `@sdxc/font/woff2` entry point: WOFF2 web fonts, decoded with a Brotli decoder that
 * ships only here, so the main entry stays small for callers who never see a `.woff2`.
 * `decodeWoff2` answers plain sfnt bytes that the main entry reads like any `.ttf`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { isFailure } from "@sdxc/result";

import type { FontError } from "../font-error.js";
import type { Font } from "../font.js";

import { parseFont } from "../parse-font.js";

import { decodeWoff2 } from "./decode.js";

export { decodeWoff2 } from "./decode.js";

/**
 * Reads a WOFF2 font. A WOFF2 holding a collection fails `unsupported`; pass the output of
 * `decodeWoff2` to `parseFontCollection` instead.
 *
 * @param bytes - The whole `.woff2` file.
 * @returns The font, or the `FontError` decoding or opening it failed with.
 * @example let font = parseWoff2(await (await fetch(url)).arrayBuffer());
 */
export function parseWoff2(bytes: Uint8Array | ArrayBuffer): Result<Font, FontError> {
	let sfnt = decodeWoff2(bytes);
	if (isFailure(sfnt)) return sfnt;
	return parseFont(sfnt.data);
}
