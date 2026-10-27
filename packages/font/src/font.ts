/**
 * A parsed TrueType font: metrics, character-to-glyph lookup, kerning, outlines and a
 * single-line layout. Wrapping, centring and painting text all read the same instance, so
 * the width a caller measures is the width that gets drawn.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure } from "@sdxc/result";

import type { CffOutlines } from "./cff/index.js";
import type { CharacterMap } from "./cmap.js";
import type { GlyphSource, Point } from "./glyf.js";
import type { FontMetrics } from "./metrics.js";
import type { GlyphNamer } from "./post.js";
import type { PairLookups } from "./tables.js";
import type { VerticalTables } from "./vertical.js";

import { isVariationSelector, mapCharacter, mappedCharacters } from "./cmap.js";
import { FontError } from "./font-error.js";
import { contoursToCommands, decodeGlyph, glyphRange } from "./glyf.js";
import { pickName } from "./names.js";
import { postGlyphNamer } from "./post.js";
import { subsetFont } from "./subset.js";
import { boundingBox, controlBox, toSVGPath } from "./svg-path.js";
import { gposPair, gposPairLookups, kernTablePair } from "./tables.js";
import {
	deviceAdvanceOf,
	readVerticalTables,
	verticalMetric,
	verticalOriginOf,
} from "./vertical.js";

/** A table's absolute location in the file. */
export interface TableRecord {
	offset: number;
	length: number;
}

/** What `parseFont` located and validated, everything a `Font` reads from afterwards. */
export interface FontData extends GlyphSource, FontMetrics {
	unitsPerEm: number;
	ascender: number;
	descender: number;
	lineGap: number;
	family: string;
	subfamily: string;
	postscriptName: string;
	numberOfHMetrics: number;
	hmtxOffset: number;
	cmap: CharacterMap;
	/** Every decoded `name` record, by name ID and language tag. */
	names: Font.Names;
	/** Absolute offset of `kern`, or `null` when the font has none. */
	kernOffset: number | null;
	/** Absolute offset of `GPOS`, or `null` when the font has none. */
	gposOffset: number | null;
	/** Every table in the directory, by tag; the subsetter copies tables from here. */
	tables: Map<string, TableRecord>;
	/** The font's CFF outlines, `null` when it draws from `glyf`. */
	cff: CffOutlines | null;
}

/** Each font's located tables, for the package's subpath entries to read. */
const FONT_DATA = new WeakMap<Font, FontData>();

/**
 * The tables `parseFont` located for a font. Package-internal: the subpath entries
 * (shaping, variations, color, subsetting) read a font through it.
 *
 * @param font - A font built by this package.
 */
export function fontData(font: Font): FontData {
	let data = FONT_DATA.get(font);
	if (data === undefined) throw new TypeError("The font was not created by @sdxc/font.");
	return data;
}

/**
 * A TrueType font ready to measure and draw. Obtain one from `parseFont`; outlines are
 * decoded on first use and cached per glyph, so a font that draws a few dozen characters
 * decodes only those glyphs.
 */
export class Font {
	/** Font units per em; divide a size in pixels by it to scale font units to pixels. */
	readonly unitsPerEm: number;
	/** Distance from the baseline to the top of the line box, in font units. */
	readonly ascender: number;
	/** Distance from the baseline to the bottom of the line box, negative, in font units. */
	readonly descender: number;
	/** Extra space between line boxes, in font units; line height is `ascender - descender + lineGap`. */
	readonly lineGap: number;
	/** Typographic family name (`"Inter"`), `""` when the font has no `name` table. */
	readonly family: string;
	/** Typographic style name (`"Regular"`), `""` when the font has no `name` table. */
	readonly subfamily: string;
	/** PostScript name from `name` ID 6 (`"Inter-Regular"`), `""` when the font records none. */
	readonly postscriptName: string;
	/** Full name from `name` ID 4 (`"Inter Regular"`) in English, `""` when the font records none. */
	readonly fullName: string;
	/** Copyright notice from `name` ID 0 in English, `""` when the font records none. */
	readonly copyright: string;
	/** Version string from `name` ID 5 (`"Version 3.019"`) in English, `""` when the font records none. */
	readonly version: string;
	/** The box every glyph fits in, from `head`, in font units. */
	readonly bbox: Font.BBox;
	/** Slant in degrees counter-clockwise from vertical, negative when the font leans right; `0` without `post`. */
	readonly italicAngle: number;
	/** Height of flat capitals in font units, `null` when `OS/2` is older than version 2. */
	readonly capHeight: number | null;
	/** Height of flat lowercase letters in font units, `null` when `OS/2` is older than version 2. */
	readonly xHeight: number | null;
	/** `OS/2.usWeightClass` (400 regular, 700 bold), `400` when the font has no `OS/2`. */
	readonly weightClass: number;
	/** Whether every glyph shares one advance, from `post.isFixedPitch`. */
	readonly isFixedPitch: boolean;
	/** Set by either `OS/2.fsSelection` ITALIC or `head.macStyle` Italic. */
	readonly isItalic: boolean;
	/** Set by either `OS/2.fsSelection` BOLD or `head.macStyle` Bold. */
	readonly isBold: boolean;
	/** Whether `OS/2.sFamilyClass` puts the design in a serif class (1–5 or 7). */
	readonly isSerif: boolean;
	/** Top of the underline relative to the baseline, negative below it, in font units. */
	readonly underlinePosition: number;
	/** Underline stroke thickness in font units, `0` without `post`. */
	readonly underlineThickness: number;
	/**
	 * What the font's license allows when it ships inside a document, from `OS/2.fsType`.
	 * The font only reports it; refusing a `restricted` font is the caller's decision.
	 */
	readonly embedding: Font.Embedding;

	#data: FontData;
	#contours = new Map<number, Point[][]>();
	#pairs = new Map<number, number>();
	#gpos: PairLookups | null = null;
	#characterSet: readonly number[] | null = null;
	#codePointsByGlyph: Map<number, number[]> | null = null;
	#glyphNamer: GlyphNamer | null = null;
	#vertical: VerticalTables | null = null;

	/**
	 * @param data - Tables located and checked by `parseFont`.
	 */
	constructor(data: FontData) {
		this.#data = data;
		FONT_DATA.set(this, data);
		this.unitsPerEm = data.unitsPerEm;
		this.ascender = data.ascender;
		this.descender = data.descender;
		this.lineGap = data.lineGap;
		this.family = data.family;
		this.subfamily = data.subfamily;
		this.postscriptName = data.postscriptName;
		this.fullName = pickName(data.names, 4) ?? "";
		this.copyright = pickName(data.names, 0) ?? "";
		this.version = pickName(data.names, 5) ?? "";
		this.bbox = data.bbox;
		this.italicAngle = data.italicAngle;
		this.capHeight = data.capHeight;
		this.xHeight = data.xHeight;
		this.weightClass = data.weightClass;
		this.isFixedPitch = data.isFixedPitch;
		this.isItalic = data.isItalic;
		this.isBold = data.isBold;
		this.isSerif = data.isSerif;
		this.underlinePosition = data.underlinePosition;
		this.underlineThickness = data.underlineThickness;
		this.embedding = data.embedding;
	}

	/** How many glyphs the font holds; valid glyph indices are `0` to `glyphCount - 1`. */
	get glyphCount(): number {
		return this.#data.numGlyphs;
	}

	/**
	 * The glyph a character draws with. With a variation selector, the variant the font's
	 * format 14 `cmap` lists for the pair, falling back to the character's usual glyph.
	 *
	 * @param codePoint - A Unicode code point, astral ones included.
	 * @param variationSelector - The selector following the character (U+FE00–FE0F,
	 *   U+E0100–E01EF), when there is one.
	 * @returns The glyph index, `0` (`.notdef`) when the font has no glyph for it.
	 * @example font.glyphIndex("A".codePointAt(0) ?? 0)
	 * @example font.glyphIndex(0x82a6, 0xe0101)
	 */
	glyphIndex(codePoint: number, variationSelector?: number): number {
		if (!Number.isInteger(codePoint) || codePoint < 0) return 0;
		let selector = Number.isInteger(variationSelector) ? variationSelector : undefined;
		let glyph = mapCharacter(this.#data.reader, this.#data.cmap, codePoint, selector);
		return glyph < this.#data.numGlyphs ? glyph : 0;
	}

	/**
	 * Whether the font draws a character with a glyph of its own rather than `.notdef`.
	 *
	 * @param codePoint - A Unicode code point.
	 */
	hasGlyph(codePoint: number): boolean {
		return this.glyphIndex(codePoint) !== 0;
	}

	/**
	 * Every code point the font maps to a glyph other than `.notdef`, ascending. Built on
	 * first use and shared afterwards, so treat it as read-only.
	 */
	get characterSet(): readonly number[] {
		this.#characterSet ??= mappedCharacters(this.#data.reader, this.#data.cmap).filter(
			(codePoint) => this.glyphIndex(codePoint) !== 0,
		);
		return this.#characterSet;
	}

	/**
	 * The characters `cmap` maps to a glyph, the reverse of `glyphIndex`. The reverse index is
	 * built from `characterSet` on the first call.
	 *
	 * @param glyph - Glyph index.
	 * @returns One string per code point, ascending; `[]` for a glyph no character maps to.
	 * @example font.stringsForGlyph(font.glyphIndex(97)) // ["a"]
	 */
	stringsForGlyph(glyph: number): string[] {
		if (this.#codePointsByGlyph === null) {
			let index = new Map<number, number[]>();
			for (let codePoint of this.characterSet) {
				let target = this.glyphIndex(codePoint);
				let list = index.get(target);
				if (list === undefined) index.set(target, [codePoint]);
				else list.push(codePoint);
			}
			this.#codePointsByGlyph = index;
		}
		return (this.#codePointsByGlyph.get(glyph) ?? []).map((codePoint) =>
			String.fromCodePoint(codePoint),
		);
	}

	/** Every `name` record the font carries, by name ID and then BCP 47 language tag. */
	get names(): Font.Names {
		return this.#data.names;
	}

	/**
	 * One `name` record in the best available language: the requested one or a regional
	 * variant of it, then English, then the first language the font lists.
	 *
	 * @param nameId - `0` copyright, `1`/`2` family/style, `4` full name, `5` version,
	 *   `6` PostScript name, `16`/`17` typographic family/style, and so on.
	 * @param language - A BCP 47 tag such as `"ar"` or `"fr-CA"`; English when omitted.
	 * @returns The name, or `null` when the font records none with that ID.
	 * @example font.name(2, "ar") // the style name in Arabic, when the font has one
	 */
	name(nameId: number, language?: string): string | null {
		return pickName(this.#data.names, nameId, language);
	}

	/**
	 * A glyph's PostScript name, from the CFF charset or the `post` table.
	 *
	 * @param glyph - Glyph index.
	 * @returns The name (`"eacute"`), or `null` when the font names no glyph or not this one.
	 */
	glyphName(glyph: number): string | null {
		let fromCff = this.#data.cff?.glyphName(glyph) ?? null;
		if (fromCff !== null) return fromCff;
		let { reader, tables, numGlyphs } = this.#data;
		this.#glyphNamer ??= postGlyphNamer(reader, tables.get("post"), numGlyphs);
		return this.#glyphNamer(glyph);
	}

	/**
	 * The tightest box around a glyph's outline, curve extremes included, in font units.
	 *
	 * @param glyph - Glyph index.
	 * @returns The box, all zeros for an empty glyph or an index the font lacks.
	 */
	glyphBBox(glyph: number): Font.BBox {
		return boundingBox(this.outline(glyph));
	}

	/**
	 * A glyph's control box: the box around every outline point, control points included.
	 * TrueType glyphs answer the box stored in their `glyf` header without decoding.
	 *
	 * @param glyph - Glyph index.
	 * @returns The box in font units, all zeros for an empty glyph or an index the font lacks.
	 */
	glyphCBox(glyph: number): Font.BBox {
		if (this.#data.cff !== null) return controlBox(this.outline(glyph));
		let range = glyphRange(this.#data, glyph);
		if (range === null) return { xMin: 0, yMin: 0, xMax: 0, yMax: 0 };
		let { reader } = this.#data;
		return {
			xMin: reader.i16(range.start + 2),
			yMin: reader.i16(range.start + 4),
			xMax: reader.i16(range.start + 6),
			yMax: reader.i16(range.start + 8),
		};
	}

	/**
	 * A glyph's outline as SVG path data in font units with y up, coordinates rounded to two
	 * decimals; wrap it in a transform that flips y to draw it.
	 *
	 * @param glyph - Glyph index.
	 * @returns Path data such as `"M201 0L201 1462…Z"`, `""` for an empty glyph.
	 * @example `<path transform="scale(1 -1)" d="${font.svgPath(glyph)}"/>`
	 */
	svgPath(glyph: number): string {
		return toSVGPath(this.outline(glyph));
	}

	/** The vertical line metrics from `vhea`, `null` when the font has no `vhea`. */
	get verticalMetrics(): Font.VerticalMetrics | null {
		return this.#verticalTables().header;
	}

	/**
	 * How far the pen moves down after a glyph in vertical text, in font units: the `vmtx`
	 * advance, or the line height `ascender - descender` for a font without one.
	 *
	 * @param glyph - Glyph index.
	 * @returns The advance, `0` for an index the font does not have.
	 */
	verticalAdvance(glyph: number): number {
		if (!this.#hasIndex(glyph)) return 0;
		let metric = verticalMetric(this.#data.reader, this.#verticalTables(), glyph);
		return metric?.advance ?? Math.abs(this.ascender - this.descender);
	}

	/**
	 * Distance from the top of the vertical line to the top of a glyph, in font units: the
	 * `vmtx` bearing, or `ascender` minus the glyph's top for a font without one.
	 *
	 * @param glyph - Glyph index.
	 * @returns The bearing, `0` for an index the font does not have.
	 */
	topSideBearing(glyph: number): number {
		if (!this.#hasIndex(glyph)) return 0;
		let metric = verticalMetric(this.#data.reader, this.#verticalTables(), glyph);
		return metric?.bearing ?? this.ascender - this.glyphCBox(glyph).yMax;
	}

	/**
	 * The y of a glyph's origin in vertical text, in font units: from `VORG` when the font
	 * has one, the glyph's top plus its `vmtx` top side bearing otherwise, and `ascender`
	 * for a font without vertical metrics.
	 *
	 * @param glyph - Glyph index.
	 */
	verticalOrigin(glyph: number): number {
		let vertical = this.#verticalTables();
		let origin = verticalOriginOf(this.#data.reader, vertical, glyph);
		if (origin !== null) return origin;
		if (!this.#hasIndex(glyph)) return this.ascender;
		let metric = verticalMetric(this.#data.reader, vertical, glyph);
		if (metric === null) return this.ascender;
		return this.glyphCBox(glyph).yMax + metric.bearing;
	}

	/**
	 * A glyph's advance hinted for one pixel size, in whole pixels, from `hdmx`.
	 *
	 * @param glyph - Glyph index.
	 * @param ppem - Pixels per em.
	 * @returns The advance, or `null` when the font has no `hdmx` record for the size.
	 */
	deviceAdvance(glyph: number, ppem: number): number | null {
		if (!this.#hasIndex(glyph)) return null;
		return deviceAdvanceOf(this.#data.reader, this.#verticalTables(), glyph, ppem);
	}

	/**
	 * How far the pen moves after drawing a glyph, in font units; `0` for an index the font
	 * does not have.
	 *
	 * @param glyph - Glyph index.
	 */
	advance(glyph: number): number {
		let { reader, hmtxOffset, numberOfHMetrics, numGlyphs } = this.#data;
		if (!Number.isInteger(glyph) || glyph < 0 || glyph >= numGlyphs) return 0;
		let metric = Math.min(glyph, numberOfHMetrics - 1);
		return reader.u16(hmtxOffset + metric * 4);
	}

	/**
	 * The adjustment to add to the pen between two glyphs, in font units, usually negative.
	 * Reads the `kern` table when the font has one and GPOS pair positioning otherwise.
	 *
	 * @param left - The glyph drawn first.
	 * @param right - The glyph drawn next.
	 * @example font.kerning(font.glyphIndex(65), font.glyphIndex(86)) // "AV", negative
	 */
	kerning(left: number, right: number): number {
		let { reader, numGlyphs, kernOffset, gposOffset } = this.#data;
		if (!Number.isInteger(left) || !Number.isInteger(right)) return 0;
		if (left < 0 || right < 0 || left >= numGlyphs || right >= numGlyphs) return 0;
		let key = left * 0x10000 + right;
		let cached = this.#pairs.get(key);
		if (cached !== undefined) return cached;
		let value = 0;
		if (kernOffset !== null) value = kernTablePair(reader, kernOffset, left, right);
		else if (gposOffset !== null) {
			this.#gpos ??= gposPairLookups(reader, gposOffset);
			value = gposPair(reader, this.#gpos, left, right);
		}
		this.#pairs.set(key, value);
		return value;
	}

	/**
	 * A glyph's contours in font units with y up, composites resolved. Every contour is a
	 * `move`, then `line` segments and `quad` (TrueType) or `cubic` (CFF) curves, then
	 * `close`; an empty glyph answers `[]`.
	 *
	 * @param glyph - Glyph index.
	 */
	outline(glyph: number): Font.Command[] {
		let cff = this.#data.cff;
		if (cff !== null) return cff.commands(glyph);
		return contoursToCommands(this.#glyphContours(glyph));
	}

	/**
	 * A table's raw bytes, for reading what this package does not interpret. The view shares
	 * the font's buffer, so it is cheap and must not be written to.
	 *
	 * @param tag - A four-character table tag, `"OS/2"` or `"cvt "` with their padding.
	 * @returns The bytes, or `null` when the font has no such table.
	 * @example font.table("DSIG")?.byteLength
	 */
	table(tag: string): Uint8Array | null {
		let record = this.#data.tables.get(tag);
		if (record === undefined) return null;
		return this.#data.reader.bytes(record.offset, record.length);
	}

	/**
	 * A glyph's outline in pixel space ready to fill: scaled to `size` pixels per em, y down,
	 * and placed so `(x, y)` is the glyph's origin on the baseline.
	 *
	 * @param glyph - Glyph index.
	 * @param size - Font size in pixels per em.
	 * @param x - Pixel x of the glyph origin.
	 * @param y - Pixel y of the baseline.
	 * @example font.path(glyph, 48, 64 + placed.x, 120)
	 */
	path(glyph: number, size: number, x: number, y: number): Font.Command[] {
		let scale = size / this.unitsPerEm;
		return this.outline(glyph).map((command): Font.Command => {
			if (command.type === "close") return command;
			if (command.type === "quad") {
				return {
					type: "quad",
					cx: x + command.cx * scale,
					cy: y - command.cy * scale,
					x: x + command.x * scale,
					y: y - command.y * scale,
				};
			}
			if (command.type === "cubic") {
				return {
					type: "cubic",
					c1x: x + command.c1x * scale,
					c1y: y - command.c1y * scale,
					c2x: x + command.c2x * scale,
					c2y: y - command.c2y * scale,
					x: x + command.x * scale,
					y: y - command.y * scale,
				};
			}
			return { type: command.type, x: x + command.x * scale, y: y - command.y * scale };
		});
	}

	/**
	 * Places a single line of text, one glyph per code point with no shaping; a variation
	 * selector picks its character's variant glyph and places none of its own. Each glyph's
	 * `x` is its origin relative to the line start; kerning and `tracking` apply between glyphs.
	 *
	 * @param text - The line; line breaks are drawn as whatever glyph the font maps them to.
	 * @param size - Font size in pixels per em.
	 * @param options - Tracking and kerning.
	 * @example font.layout("Hello", 32, { tracking: -0.5 }).width
	 */
	layout(text: string, size: number, options: Font.LayoutOptions = {}): Font.Line {
		let glyphs: Font.PlacedGlyph[] = [];
		let width = this.#walk(text, size, options, glyphs);
		return { glyphs, width };
	}

	/**
	 * The width `layout` would answer for the same arguments, without building the list.
	 *
	 * @param text - The line.
	 * @param size - Font size in pixels per em.
	 * @param options - Tracking and kerning.
	 */
	measure(text: string, size: number, options: Font.LayoutOptions = {}): number {
		return this.#walk(text, size, options, null);
	}

	/**
	 * Advances a pen across the text, recording each glyph when `glyphs` is a list.
	 *
	 * @returns The pen position after the last glyph.
	 */
	#walk(
		text: string,
		size: number,
		options: Font.LayoutOptions,
		glyphs: Font.PlacedGlyph[] | null,
	): number {
		let scale = size / this.unitsPerEm;
		let tracking = options.tracking ?? 0;
		let kerning = options.kerning ?? true;
		let pen = 0;
		let previous = -1;
		for (let index = 0; index < text.length;) {
			let codePoint = text.codePointAt(index) ?? 0;
			index += codePoint > 0xffff ? 2 : 1;
			if (isVariationSelector(codePoint)) continue;
			let next = text.codePointAt(index);
			let selector = next !== undefined && isVariationSelector(next) ? next : undefined;
			let glyph = this.glyphIndex(codePoint, selector);
			if (previous >= 0) {
				pen += tracking;
				if (kerning) pen += this.kerning(previous, glyph) * scale;
			}
			let advance = this.advance(glyph) * scale;
			glyphs?.push({ glyph, codePoint, x: pen, advance });
			pen += advance;
			previous = glyph;
		}
		return pen;
	}

	/**
	 * Writes a smaller TrueType font holding only the given glyphs, for embedding. Glyph 0
	 * (`.notdef`) stays 0, the rest are renumbered in the order given, and components of
	 * composite glyphs follow them; ids the font lacks and repeats are skipped.
	 *
	 * @param glyphs - Glyph indices of this font.
	 * @returns The subset, or a `FontError` with code `not-permitted` when
	 *   `embedding.subsetting` is `false`.
	 * @example let subset = unwrap(font.subset(line.glyphs.map(({ glyph }) => glyph)));
	 */
	subset(glyphs: Iterable<number>): Result<Font.Subset, FontError> {
		if (this.#data.cff !== null) {
			return failure(
				new FontError("unsupported", "Subsetting CFF outlines is not supported yet.", "CFF "),
			);
		}
		if (!this.embedding.subsetting) {
			return failure(
				new FontError(
					"not-permitted",
					"The font's license (OS/2 fsType) forbids subsetting.",
					"OS/2",
				),
			);
		}
		return subsetFont(this.#data, glyphs);
	}

	/**
	 * Whether a glyph index exists in the font.
	 *
	 * @param glyph - Glyph index.
	 */
	#hasIndex(glyph: number): boolean {
		return Number.isInteger(glyph) && glyph >= 0 && glyph < this.#data.numGlyphs;
	}

	/** The vertical and device metric tables, located on first use. */
	#verticalTables(): VerticalTables {
		let { reader, tables, numGlyphs } = this.#data;
		this.#vertical ??= readVerticalTables(reader, tables, numGlyphs);
		return this.#vertical;
	}

	/**
	 * Decoded contours for a glyph, cached so repeated draws of one character decode once.
	 *
	 * @param glyph - Glyph index.
	 */
	#glyphContours(glyph: number): Point[][] {
		let cached = this.#contours.get(glyph);
		if (cached !== undefined) return cached;
		let contours = decodeGlyph(this.#data, glyph);
		this.#contours.set(glyph, contours);
		return contours;
	}
}

export namespace Font {
	/** A rectangle in font units, y up. */
	export interface BBox {
		xMin: number;
		yMin: number;
		xMax: number;
		yMax: number;
	}

	/** `name` records by name ID, then BCP 47 language tag (`"en"`, `"ar"`, `"3-1033"`). */
	export interface Names {
		readonly [nameId: number]: Readonly<Record<string, string>>;
	}

	/** Line metrics for vertical text from `vhea`, in font units. */
	export interface VerticalMetrics {
		/** Distance from the centre line to the right edge of the vertical line box. */
		ascender: number;
		/** Distance from the centre line to the left edge, usually negative. */
		descender: number;
		lineGap: number;
	}

	/** `OS/2.fsType` usage permission, from least to most restrictive. */
	export type EmbeddingLevel = "installable" | "editable" | "preview-and-print" | "restricted";

	/** What a font's license allows a document that embeds it. */
	export interface Embedding {
		allowed: EmbeddingLevel;
		/** `false` when the font must ship whole. */
		subsetting: boolean;
		/** `true` when only the font's bitmaps may be embedded, never its outlines. */
		bitmapOnly: boolean;
	}

	/** A subset font file and how the original glyph ids map into it. */
	export interface Subset {
		/** A complete `.ttf`, readable by `parseFont`. */
		bytes: Uint8Array;
		/** Original glyph id of each subset glyph, indexed by subset id; `glyphs[0]` is `0`. */
		glyphs: readonly number[];
		/**
		 * A glyph's id in the subset, `0` for one the subset does not hold.
		 *
		 * @param original - Glyph id in the font `subset` was called on.
		 */
		glyphId(original: number): number;
	}

	/** Starts a contour (`move`) or draws a straight segment to a point (`line`). */
	export interface PointCommand {
		type: "move" | "line";
		x: number;
		y: number;
	}

	/** A quadratic Bézier segment through control point `(cx, cy)` to `(x, y)`. */
	export interface QuadCommand {
		type: "quad";
		cx: number;
		cy: number;
		x: number;
		y: number;
	}

	/** A cubic Bézier segment through control points `(c1x, c1y)` and `(c2x, c2y)` to `(x, y)`. */
	export interface CubicCommand {
		type: "cubic";
		c1x: number;
		c1y: number;
		c2x: number;
		c2y: number;
		x: number;
		y: number;
	}

	/** Ends the contour with a straight segment back to its `move` point. */
	export interface CloseCommand {
		type: "close";
	}

	/** One step of an outline, in font units from `outline` and pixels from `path`. */
	export type Command = PointCommand | QuadCommand | CubicCommand | CloseCommand;

	/** How `layout` and `measure` space glyphs. */
	export interface LayoutOptions {
		/**
		 * Extra pixels after every glyph but the last; negative tightens the line.
		 * @default 0
		 */
		tracking?: number;
		/**
		 * Whether to apply the font's pair kerning.
		 * @default true
		 */
		kerning?: boolean;
	}

	/** One glyph placed on a line, in pixels relative to the line start. */
	export interface PlacedGlyph {
		glyph: number;
		/** The character this glyph draws. */
		codePoint: number;
		/** Origin of the glyph on the baseline; pass it to `path` offset by the line's start. */
		x: number;
		/** The glyph's own advance at this size, before kerning and tracking. */
		advance: number;
	}

	/** A laid-out line: its glyphs in order and the total width in pixels. */
	export interface Line {
		glyphs: PlacedGlyph[];
		width: number;
	}
}
