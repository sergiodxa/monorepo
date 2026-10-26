/**
 * CFF and CFF2 outlines: opens a font's `CFF ` or `CFF2` table and answers each glyph's
 * cubic outline and charset name. `openSfnt` calls it for every font without `glyf`, so an
 * OpenType font with PostScript outlines reads through the same `Font` as a TrueType one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure } from "@sdxc/result";

import type { Font, TableRecord } from "../font.js";
import type { Reader } from "../reader.js";

import { FontError } from "../font-error.js";

/** A font's CFF outlines, decoded per glyph on request. */
export interface CffOutlines {
	/** `cff` for a `CFF ` table, `cff2` for a variable `CFF2` table. */
	readonly kind: "cff" | "cff2";
	/**
	 * A glyph's outline in font units, y up: `move`, `line` and `cubic` commands, each
	 * contour ending in `close`; `[]` for an empty glyph or an index the font lacks.
	 *
	 * @param glyph - Glyph index.
	 */
	commands(glyph: number): Font.Command[];
	/**
	 * The glyph's name from the charset, `null` for a CID-keyed font or a CFF2 table.
	 *
	 * @param glyph - Glyph index.
	 */
	glyphName(glyph: number): string | null;
}

/**
 * Opens the `CFF ` or `CFF2` table of a font.
 *
 * @param reader - The whole file.
 * @param tables - The font's table directory, holding `CFF ` or `CFF2`.
 * @param numGlyphs - From `maxp`, which the CharStrings INDEX must match.
 */
export function openCff(
	reader: Reader,
	tables: Map<string, TableRecord>,
	numGlyphs: number,
): Result<CffOutlines, FontError> {
	void reader;
	void numGlyphs;
	let tag = tables.has("CFF2") ? "CFF2" : "CFF ";
	return failure(new FontError("unsupported", "CFF outlines are not supported yet.", tag));
}
