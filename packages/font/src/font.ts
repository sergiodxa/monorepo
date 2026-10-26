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

import type { GlyphSource, Point } from "./glyf.js";
import type { FontMetrics } from "./metrics.js";
import type { CmapSubtable, PairLookups } from "./tables.js";

import { FontError } from "./font-error.js";
import { contoursToCommands, decodeGlyph } from "./glyf.js";
import { subsetFont } from "./subset.js";
import { gposPair, gposPairLookups, kernTablePair, lookupCmap } from "./tables.js";

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
	cmap: CmapSubtable;
	/** Absolute offset of `kern`, or `null` when the font has none. */
	kernOffset: number | null;
	/** Absolute offset of `GPOS`, or `null` when the font has none. */
	gposOffset: number | null;
	/** Every table in the directory, by tag; the subsetter copies tables from here. */
	tables: Map<string, TableRecord>;
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

	/**
	 * @param data - Tables located and checked by `parseFont`.
	 */
	constructor(data: FontData) {
		this.#data = data;
		this.unitsPerEm = data.unitsPerEm;
		this.ascender = data.ascender;
		this.descender = data.descender;
		this.lineGap = data.lineGap;
		this.family = data.family;
		this.subfamily = data.subfamily;
		this.postscriptName = data.postscriptName;
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
	 * The glyph a character draws with.
	 *
	 * @param codePoint - A Unicode code point, astral ones included.
	 * @returns The glyph index, `0` (`.notdef`) when the font has no glyph for it.
	 * @example font.glyphIndex("A".codePointAt(0) ?? 0)
	 */
	glyphIndex(codePoint: number): number {
		if (!Number.isInteger(codePoint) || codePoint < 0) return 0;
		let glyph = lookupCmap(this.#data.reader, this.#data.cmap, codePoint);
		return glyph < this.#data.numGlyphs ? glyph : 0;
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
	 * `move`, then `line`/`quad` segments, then `close`; an empty glyph answers `[]`.
	 *
	 * @param glyph - Glyph index.
	 */
	outline(glyph: number): Font.Command[] {
		return contoursToCommands(this.#glyphContours(glyph));
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
			return { type: command.type, x: x + command.x * scale, y: y - command.y * scale };
		});
	}

	/**
	 * Places a single line of text, one glyph per code point with no shaping. Each glyph's
	 * `x` is its origin relative to the line start; kerning (on by default) and `tracking`
	 * apply between glyphs, so `width` ends at the last glyph's advance.
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
		for (let character of text) {
			let codePoint = character.codePointAt(0) ?? 0;
			let glyph = this.glyphIndex(codePoint);
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

	/** Ends the contour with a straight segment back to its `move` point. */
	export interface CloseCommand {
		type: "close";
	}

	/** One step of an outline, in font units from `outline` and pixels from `path`. */
	export type Command = PointCommand | QuadCommand | CloseCommand;

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
