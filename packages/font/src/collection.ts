/**
 * Font collections: TrueType collections (`ttcf`, versions 1 and 2) and Mac `dfont` files,
 * which hold several fonts that often share tables. `parseFontCollection` opens every font in
 * one, and a single font or WOFF opens as a collection of one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Font } from "./font.js";

import { dfontFonts } from "./dfont.js";
import { FontError } from "./font-error.js";
import { hasFontSignature, openFont } from "./parse-font.js";
import { Reader } from "./reader.js";
import { openSfnt } from "./sfnt.js";

/** Every font of a collection file, in the order the file lists them. */
export class FontCollection {
	/** The fonts, each sharing the file's bytes. */
	readonly fonts: readonly Font[];

	/**
	 * @param fonts - The opened fonts.
	 */
	constructor(fonts: readonly Font[]) {
		this.fonts = fonts;
	}

	/**
	 * Finds a font by PostScript name, the name a PDF or CSS `src: local()` refers to it by.
	 *
	 * @param postscriptName - `name` ID 6, such as `"NotoSans-Italic"`.
	 * @returns The first font with that name, or `null` when none has it.
	 * @example collection.get("NotoSans-Bold")?.weightClass
	 */
	get(postscriptName: string): Font | null {
		return this.fonts.find((font) => font.postscriptName === postscriptName) ?? null;
	}
}

/**
 * Reads every font of a TrueType collection (`.ttc`) or Mac `dfont`; a single TrueType,
 * OpenType or WOFF font comes back as a collection of one. A collection fails as a whole
 * when any of its fonts cannot be read, with that font's error.
 *
 * @param bytes - The whole file. A WOFF2 file is decoded first with `decodeWoff2` from
 *   `@sdxc/font/woff2`, and its output passed here.
 * @returns The collection, or the `FontError` of the first font that fails.
 * @example unwrap(parseFontCollection(bytes)).get("NotoSans-Italic")
 */
export function parseFontCollection(
	bytes: Uint8Array | ArrayBuffer,
): Result<FontCollection, FontError> {
	let reader = new Reader(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
	if (reader.length >= 12 && reader.tag(0) === "ttcf") return openTtc(reader);
	let spans = hasFontSignature(reader) ? null : dfontFonts(reader);
	if (spans !== null) {
		let fonts: Font[] = [];
		for (let span of spans) {
			let font = openSfnt(new Reader(reader.bytes(span.offset, span.length)), 0);
			if (isFailure(font)) return font;
			fonts.push(font.data);
		}
		return success(new FontCollection(fonts));
	}
	let font = openFont(reader);
	if (isFailure(font)) return font;
	return success(new FontCollection([font.data]));
}

/**
 * Opens each font of a `ttcf` file; version 2 only adds a DSIG record after the offsets,
 * which reading needs nothing from.
 *
 * @param reader - The whole file, starting with `ttcf`.
 */
function openTtc(reader: Reader): Result<FontCollection, FontError> {
	let major = reader.u16(4);
	let count = reader.u32(8);
	if (major !== 1 && major !== 2) {
		return failure(
			new FontError("unsupported", `TrueType collection version ${major} is unknown.`),
		);
	}
	if (count === 0 || 12 + count * 4 > reader.length) {
		return failure(new FontError("malformed", "The collection's font offsets are truncated."));
	}
	let fonts: Font[] = [];
	for (let index = 0; index < count; index++) {
		let font = openSfnt(reader, reader.u32(12 + index * 4));
		if (isFailure(font)) return font;
		fonts.push(font.data);
	}
	return success(new FontCollection(fonts));
}
