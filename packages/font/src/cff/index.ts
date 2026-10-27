/**
 * CFF and CFF2 outlines: opens a font's `CFF ` or `CFF2` table and answers each glyph's
 * cubic outline and charset name. `openSfnt` calls it for every font without `glyf`, so an
 * OpenType font with PostScript outlines reads through the same `Font` as a TrueType one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { isFailure, success } from "@sdxc/result";

import type { FontError } from "../font-error.js";
import type { Font, TableRecord } from "../font.js";
import type { ItemVariationStore } from "../item-variation-store.js";
import type { Reader } from "../reader.js";

import { blendScalars, readItemVariationStore } from "../item-variation-store.js";

import type { Charstring, CharstringContext } from "./charstring.js";
import type { CffTable } from "./table.js";

import { runCharstring } from "./charstring.js";
import { STANDARD_ENCODING } from "./standard.data.js";
import { cffString, parseCffTable } from "./table.js";

export type { CffDict } from "./dict.js";
export type { CffIndex, CffItem } from "./index-table.js";
export type { CffCharset, CffFdSelect, CffFontDict, CffPrivate, CffTable } from "./table.js";

export { DICT_OP } from "./dict.js";
export { indexItem } from "./index-table.js";
export { cffString } from "./table.js";

/** A font's CFF outlines, decoded per glyph on request. */
export interface CffOutlines {
	/** `cff` for a `CFF ` table, `cff2` for a variable `CFF2` table. */
	readonly kind: "cff" | "cff2";
	/** The parsed table, whose INDEXes, DICTs, charset and FDSelect a subsetter rewrites. */
	readonly table: CffTable;
	/**
	 * A glyph's outline in font units, y up: `move`, `line` and `cubic` commands, each
	 * contour ending in `close`; `[]` for an empty glyph or an index the font lacks.
	 *
	 * @param glyph - Glyph index.
	 * @param coords - Normalized variation coordinates in `fvar` axis order, which CFF2
	 *   `blend` reads; absent or all zero draws the default instance.
	 */
	commands(glyph: number, coords?: readonly number[]): Font.Command[];
	/**
	 * The glyph's name from the charset, `null` for a CID-keyed font or a CFF2 table.
	 *
	 * @param glyph - Glyph index.
	 */
	glyphName(glyph: number): string | null;
	/**
	 * The advance width the glyph's charstring states, `null` for CFF2, whose charstrings
	 * carry none; `hmtx` stays the source of advances.
	 *
	 * @param glyph - Glyph index.
	 */
	width(glyph: number): number | null;
}

/**
 * Opens the `CFF ` or `CFF2` table of a font. The table's structures are read and checked
 * here; charstrings run when a glyph's outline is first asked for, and the default
 * instance's outline is kept for the next call.
 *
 * @param reader - The whole file.
 * @param tables - The font's table directory, holding `CFF ` or `CFF2`.
 * @param numGlyphs - From `maxp`, which the CharStrings INDEX must match.
 * @returns The outlines, or a `malformed` `FontError` naming the table.
 */
export function openCff(
	reader: Reader,
	tables: Map<string, TableRecord>,
	numGlyphs: number,
): Result<CffOutlines, FontError> {
	let parsed = parseCffTable(reader, tables, numGlyphs);
	if (isFailure(parsed)) return parsed;
	return success(new CffGlyphs(reader, parsed.data));
}

/** The `CffOutlines` of one parsed table, caching default-instance charstrings. */
class CffGlyphs implements CffOutlines {
	readonly kind: "cff" | "cff2";
	readonly table: CffTable;
	#reader: Reader;
	#cache = new Map<number, Charstring>();
	#store: ItemVariationStore | null;
	#glyphsBySid: Map<number, number> | null = null;

	/**
	 * @param reader - The whole file.
	 * @param table - The parsed table.
	 */
	constructor(reader: Reader, table: CffTable) {
		this.#reader = reader;
		this.table = table;
		this.kind = table.version === 2 ? "cff2" : "cff";
		this.#store =
			table.variationStore === null ? null : readItemVariationStore(reader, table.variationStore);
	}

	commands(glyph: number, coords?: readonly number[]): Font.Command[] {
		if (coords !== undefined && this.kind === "cff2" && coords.some((coord) => coord !== 0)) {
			return runCharstring(this.#context(coords), glyph).commands;
		}
		return this.#default(glyph).commands.slice();
	}

	glyphName(glyph: number): string | null {
		let charset = this.table.charset;
		if (charset === null || this.table.cid) return null;
		if (glyph === 0) return ".notdef";
		let sid = charset.ids[glyph];
		if (sid === undefined || sid === 0) return null;
		return cffString(this.#reader, this.table, sid);
	}

	width(glyph: number): number | null {
		if (this.kind === "cff2") return null;
		return this.#default(glyph).width;
	}

	/**
	 * The default instance's decoded charstring, run once per glyph.
	 *
	 * @param glyph - Glyph index.
	 */
	#default(glyph: number): Charstring {
		let cached = this.#cache.get(glyph);
		if (cached !== undefined) return cached;
		let decoded = runCharstring(this.#context([]), glyph);
		this.#cache.set(glyph, decoded);
		return decoded;
	}

	/**
	 * What the interpreter needs to draw at `coords`, blend scalars computed once per
	 * ItemVariationStore subtable.
	 *
	 * @param coords - Normalized coordinates, `[]` for the default instance.
	 */
	#context(coords: readonly number[]): CharstringContext {
		let store = this.#store;
		let scalars = new Map<number, readonly number[]>();
		return {
			reader: this.#reader,
			table: this.table,
			blendScalars: (vsindex) => {
				let found = scalars.get(vsindex);
				if (found !== undefined) return found;
				let computed = store === null ? [] : blendScalars(store, vsindex, coords);
				scalars.set(vsindex, computed);
				return computed;
			},
			standardGlyph: (code) => this.#standardGlyph(code),
		};
	}

	/**
	 * The glyph a Standard encoding code names, found through the charset by its SID.
	 *
	 * @param code - Character code 0–255.
	 */
	#standardGlyph(code: number): number | null {
		let charset = this.table.charset;
		let sid = STANDARD_ENCODING[code] ?? 0;
		if (charset === null || this.table.cid || sid === 0) return null;
		if (this.#glyphsBySid === null) {
			this.#glyphsBySid = new Map();
			for (let glyph = charset.ids.length - 1; glyph >= 0; glyph--) {
				this.#glyphsBySid.set(charset.ids[glyph] ?? 0, glyph);
			}
		}
		return this.#glyphsBySid.get(sid) ?? null;
	}
}
