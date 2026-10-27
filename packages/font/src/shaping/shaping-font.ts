/**
 * What shaping reads from a font, located once per `Font` and cached: its layout tables
 * (GSUB, GPOS, GDEF, `kern`, `morx`, `feat`), its instance coordinates and a cached
 * character-to-glyph lookup, so every table is found once however much text is shaped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Font, FontData, TableRecord } from "../font.js";
import type { ItemVariationStore } from "../item-variation-store.js";
import type { Reader } from "../reader.js";

import { fontData } from "../font.js";
import { readItemVariationStore } from "../item-variation-store.js";
import { variationOf } from "../variations/variation.js";

import type { AatFeature } from "./aat/feat.js";
import type { MorxTable } from "./aat/morx.js";
import type { LayoutTable } from "./layout-table.js";

import { readFeat } from "./aat/feat.js";
import { readMorx } from "./aat/morx.js";
import { coverageIndex, glyphClass, readLayoutTable } from "./layout-table.js";

/** GDEF glyph classes, the values `glyphClass` answers from its glyph class definition. */
export const GLYPH_CLASS = { BASE: 1, LIGATURE: 2, MARK: 3, COMPONENT: 4 };

/** The parts of GDEF shaping reads, as absolute offsets, `0` for a part the font lacks. */
export interface Gdef {
	glyphClassDef: number;
	markAttachClassDef: number;
	/** Absolute offsets of each mark glyph set's coverage table. */
	markGlyphSets: number[];
	/** Absolute offset of the item variation store, for variation deltas on anchors and values. */
	itemVariationStore: number;
}

/** A font as shaping sees it. */
export interface ShapingFont {
	font: Font;
	data: FontData;
	reader: Reader;
	gsub: LayoutTable | null;
	gpos: LayoutTable | null;
	gdef: Gdef | null;
	kern: TableRecord | null;
	/** The AAT `morx` table, which shapes a font that has no GSUB. */
	morx: MorxTable | null;
	/** The AAT `feat` table's feature types, by type; empty without one. */
	feat: Map<number, AatFeature>;
	/** How many variation axes `fvar` declares. */
	axisCount: number;
	/**
	 * The normalized coordinates of the instance this font was varied to, one per axis; empty
	 * at the default location. Feature variations and GPOS variation deltas read them.
	 */
	coords: readonly number[];
	/** GDEF's item variation store, which GPOS VariationIndex tables point into. */
	variationStore: ItemVariationStore | null;
	/**
	 * The glyph a code point maps to, `0` when the font has none; cached per code point.
	 *
	 * @param codePoint - A Unicode code point.
	 */
	glyphIndex(codePoint: number): number;
	/**
	 * Whether a mark glyph belongs to a GDEF mark glyph set.
	 *
	 * @param set - Mark glyph set index.
	 * @param glyph - Glyph index.
	 */
	inMarkSet(set: number, glyph: number): boolean;
}

/** Each font's shaping view, built on first use. */
const SHAPING_FONTS = new WeakMap<Font, ShapingFont>();

/**
 * The shaping view of a font, built once and reused for every later `shape` call.
 *
 * @param font - A font from `parseFont`.
 */
export function shapingFont(font: Font): ShapingFont {
	let cached = SHAPING_FONTS.get(font);
	if (cached !== undefined) return cached;
	let data = fontData(font);
	let { reader, tables } = data;
	let gsubRecord = tables.get("GSUB");
	let gposRecord = tables.get("GPOS");
	let gdefRecord = tables.get("GDEF");
	let fvar = tables.get("fvar");
	let morxRecord = tables.get("morx");
	let featRecord = tables.get("feat");
	let gdef = gdefRecord === undefined ? null : readGdef(reader, gdefRecord);
	let glyphs = new Map<number, number>();
	let shaping: ShapingFont = {
		font,
		data,
		reader,
		gsub: gsubRecord === undefined ? null : readLayoutTable(reader, "GSUB", gsubRecord),
		gpos: gposRecord === undefined ? null : readLayoutTable(reader, "GPOS", gposRecord),
		gdef,
		kern: tables.get("kern") ?? null,
		morx: morxRecord === undefined ? null : readMorx(reader, morxRecord),
		feat: featRecord === undefined ? new Map() : readFeat(reader, featRecord),
		axisCount: fvar === undefined ? 0 : reader.u16(fvar.offset + 8),
		coords: variationOf(data)?.coords ?? [],
		variationStore:
			gdef === null || gdef.itemVariationStore === 0
				? null
				: readItemVariationStore(reader, gdef.itemVariationStore),
		glyphIndex(codePoint) {
			let glyph = glyphs.get(codePoint);
			if (glyph === undefined) {
				glyph = font.glyphIndex(codePoint);
				glyphs.set(codePoint, glyph);
			}
			return glyph;
		},
		inMarkSet(set, glyph) {
			let coverage = gdef?.markGlyphSets[set];
			return coverage !== undefined && coverageIndex(reader, coverage, glyph) >= 0;
		},
	};
	SHAPING_FONTS.set(font, shaping);
	return shaping;
}

/**
 * Locates GDEF's class definitions, mark glyph sets (version 1.2) and variation store
 * (version 1.3), each only when the table is long enough to hold its offset.
 *
 * @param reader - The font bytes.
 * @param record - The GDEF directory entry.
 */
function readGdef(reader: Reader, record: TableRecord): Gdef | null {
	let { offset, length } = record;
	if (length < 12 || reader.u16(offset) !== 1) return null;
	let minor = reader.u16(offset + 2);
	let at = (relative: number) => (relative > 0 && relative < length ? offset + relative : 0);
	let markGlyphSets: number[] = [];
	if (minor >= 2 && length >= 14) {
		let sets = at(reader.u16(offset + 12));
		if (sets !== 0 && reader.u16(sets) === 1) {
			let count = reader.u16(sets + 2);
			for (let index = 0; index < count; index++) {
				markGlyphSets.push(sets + reader.u32(sets + 4 + index * 4));
			}
		}
	}
	return {
		glyphClassDef: at(reader.u16(offset + 4)),
		markAttachClassDef: at(reader.u16(offset + 10)),
		markGlyphSets,
		itemVariationStore: minor >= 3 && length >= 18 ? at(reader.u32(offset + 14)) : 0,
	};
}

/**
 * A glyph's GDEF glyph class, `0` when GDEF does not classify it.
 *
 * @param font - The shaping view.
 * @param glyph - Glyph index.
 */
export function gdefGlyphClass(font: ShapingFont, glyph: number): number {
	let offset = font.gdef?.glyphClassDef ?? 0;
	return glyphClass(font.reader, offset, glyph);
}

/**
 * A mark glyph's GDEF mark attachment class, `0` when GDEF assigns none.
 *
 * @param font - The shaping view.
 * @param glyph - Glyph index.
 */
export function markAttachmentClass(font: ShapingFont, glyph: number): number {
	let offset = font.gdef?.markAttachClassDef ?? 0;
	return glyphClass(font.reader, offset, glyph);
}
