/**
 * Walks the shaping buffer the way a lookup sees it: glyphs its `LookupFlag` ignores (bases,
 * ligatures, marks, marks of another attachment class or outside its mark filtering set)
 * are stepped over, so context matching and pair positioning see only the glyphs they act on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { GlyphInfo } from "./glyph-info.js";
import type { ShapingFont } from "./shaping-font.js";

import { LOOKUP_FLAG } from "./layout-table.js";

/** A cursor over a glyph buffer, filtered by one lookup's flags. */
export class GlyphIterator {
	/** The buffer; processors splice it, and the iterator always reads the current array. */
	glyphs: GlyphInfo[];
	/** Position in `glyphs`; may sit one before the start or one past the end. */
	index = 0;
	/** The current lookup's `LookupFlag`. */
	flags = 0;
	/** The current lookup's mark filtering set, `-1` when it uses none. */
	markFilteringSet = -1;

	#font: ShapingFont;

	/**
	 * @param font - The font, for mark filtering sets.
	 * @param glyphs - The buffer.
	 */
	constructor(font: ShapingFont, glyphs: GlyphInfo[]) {
		this.#font = font;
		this.glyphs = glyphs;
	}

	/**
	 * Points the iterator at a glyph under a lookup's flags.
	 *
	 * @param flags - The lookup's `LookupFlag`.
	 * @param index - Starting buffer index.
	 * @param markFilteringSet - The lookup's mark glyph set, `-1` for none.
	 */
	reset(flags: number, index: number, markFilteringSet: number) {
		this.flags = flags;
		this.index = index;
		this.markFilteringSet = markFilteringSet;
	}

	/** The glyph at the cursor, `null` outside the buffer. */
	get current(): GlyphInfo | null {
		return this.glyphs[this.index] ?? null;
	}

	/**
	 * Whether the current lookup steps over a glyph. A mark filtering set decides alone for
	 * marks; otherwise the ignore flags and the mark attachment type apply.
	 *
	 * @param glyph - A buffer glyph.
	 */
	shouldIgnore(glyph: GlyphInfo): boolean {
		let flags = this.flags;
		if (glyph.isMark && (flags & LOOKUP_FLAG.USE_MARK_FILTERING_SET) !== 0) {
			return !this.#font.inMarkSet(this.markFilteringSet, glyph.glyph);
		}
		if (glyph.isMark && (flags & LOOKUP_FLAG.IGNORE_MARKS) !== 0) return true;
		if (glyph.isBase && (flags & LOOKUP_FLAG.IGNORE_BASE_GLYPHS) !== 0) return true;
		if (glyph.isLigature && (flags & LOOKUP_FLAG.IGNORE_LIGATURES) !== 0) return true;
		let attachment = flags >> 8;
		return attachment !== 0 && glyph.isMark && glyph.markAttachmentType !== attachment;
	}

	/**
	 * Moves one considered glyph forward (`1`) or backward (`-1`).
	 *
	 * @param direction - `1` or `-1`.
	 * @returns The glyph reached, `null` past either end.
	 */
	move(direction: number): GlyphInfo | null {
		this.index += direction;
		while (this.index >= 0 && this.index < this.glyphs.length) {
			let glyph = this.glyphs[this.index];
			if (glyph !== undefined && !this.shouldIgnore(glyph)) return glyph;
			this.index += direction;
		}
		return null;
	}

	/** Moves to the next considered glyph. */
	next(): GlyphInfo | null {
		return this.move(1);
	}

	/** Moves to the previous considered glyph. */
	previous(): GlyphInfo | null {
		return this.move(-1);
	}

	/**
	 * Moves `count` considered glyphs, backward when negative.
	 *
	 * @param count - How many glyphs.
	 * @returns The glyph reached, `null` outside the buffer.
	 */
	increment(count: number): GlyphInfo | null {
		let direction = count < 0 ? -1 : 1;
		for (let step = Math.abs(count); step > 0; step--) this.move(direction);
		return this.glyphs[this.index] ?? null;
	}

	/**
	 * The buffer index `count` considered glyphs away, leaving the cursor where it was.
	 *
	 * @param count - How many glyphs, backward when negative.
	 */
	peekIndex(count = 1): number {
		let start = this.index;
		this.increment(count);
		let reached = this.index;
		this.index = start;
		return reached;
	}

	/**
	 * The glyph `count` considered glyphs away, leaving the cursor where it was.
	 *
	 * @param count - How many glyphs, backward when negative.
	 */
	peek(count = 1): GlyphInfo | null {
		return this.glyphs[this.peekIndex(count)] ?? null;
	}
}
