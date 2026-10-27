/**
 * One glyph in the shaping buffer: its glyph index, the characters it draws, its cluster,
 * the features enabled on it, and the ligature and attachment state GSUB and GPOS pass
 * between lookups. Setting `glyph` refreshes the GDEF classes lookup flags filter on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ShapingFont } from "./shaping-font.js";

import { GLYPH_CLASS, gdefGlyphClass, markAttachmentClass } from "./shaping-font.js";
import { generalCategory } from "./unicode/properties.js";

/** A glyph being shaped. Shapers mutate these in place and splice the array that holds them. */
export class GlyphInfo {
	/** The characters this glyph draws, in logical order; a ligature holds all its components'. */
	codePoints: number[];
	/** UTF-16 offset of the first character of the cluster this glyph belongs to. */
	cluster: number;
	/** Feature tags enabled on this glyph; a lookup applies only to glyphs carrying its feature. */
	features: Set<string>;
	/** Shared by a ligature and the marks that were skipped while forming it, `0` otherwise. */
	ligatureId = 0;
	/**
	 * Which component of the ligature (1-based) a mark attaches to, or which glyph of a multiple
	 * substitution this is; `0` when neither.
	 */
	ligatureComponent = 0;
	/** Whether a ligature substitution produced this glyph. */
	isLigated = false;
	/** Whether a GSUB lookup has replaced this glyph since the flag was last cleared. */
	substituted = false;
	/** Whether a multiple substitution produced this glyph from another one. */
	isMultiplied = false;
	/** Buffer index of the glyph this one's cursive exit connects to, `null` when unattached. */
	cursiveAttachment: number | null = null;
	/** Buffer index of the base or mark this mark is positioned on, `null` when unattached. */
	markAttachment: number | null = null;
	/** Per-glyph state a script shaper keeps between its stages; each shaper owns its shape. */
	shaperInfo: unknown = null;
	/** GDEF base glyph, or a glyph that is neither mark nor ligature without GDEF. */
	isBase = true;
	/** GDEF ligature glyph. */
	isLigature = false;
	/** GDEF mark glyph, or a non-spacing mark character without GDEF glyph classes. */
	isMark = false;
	/** GDEF mark attachment class, `0` for none. */
	markAttachmentType = 0;

	#font: ShapingFont;
	#glyph = 0;

	/**
	 * @param font - The font being shaped.
	 * @param glyph - Glyph index.
	 * @param codePoints - The characters it draws.
	 * @param cluster - UTF-16 offset of its cluster.
	 * @param features - Features to enable on it, copied.
	 */
	constructor(
		font: ShapingFont,
		glyph: number,
		codePoints: number[],
		cluster: number,
		features: Iterable<string> = [],
	) {
		this.#font = font;
		this.codePoints = codePoints;
		this.cluster = cluster;
		this.features = new Set(features);
		this.glyph = glyph;
		this.substituted = false;
	}

	/** Glyph index; assigning it marks the glyph substituted and reclassifies it. */
	get glyph(): number {
		return this.#glyph;
	}

	set glyph(glyph: number) {
		this.#glyph = glyph;
		this.substituted = true;
		let font = this.#font;
		if (font.gdef !== null && font.gdef.glyphClassDef !== 0) {
			let glyphClass = gdefGlyphClass(font, glyph);
			this.isBase = glyphClass === GLYPH_CLASS.BASE;
			this.isLigature = glyphClass === GLYPH_CLASS.LIGATURE;
			this.isMark = glyphClass === GLYPH_CLASS.MARK;
			this.markAttachmentType = this.isMark ? markAttachmentClass(font, glyph) : 0;
			return;
		}
		this.isMark =
			this.codePoints.length > 0 &&
			this.codePoints.every((codePoint) => generalCategory(codePoint) === "Mn");
		this.isBase = !this.isMark;
		this.isLigature = this.codePoints.length > 1;
		this.markAttachmentType = 0;
	}

	/** The font this glyph belongs to. */
	get font(): ShapingFont {
		return this.#font;
	}

	/**
	 * A fresh glyph with the same index, characters, cluster and features, and none of the
	 * ligature or attachment state; reordering shapers copy glyphs they move.
	 */
	copy(): GlyphInfo {
		return new GlyphInfo(this.#font, this.#glyph, this.codePoints, this.cluster, this.features);
	}
}
