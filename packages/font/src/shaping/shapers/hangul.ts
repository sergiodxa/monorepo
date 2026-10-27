/**
 * The Hangul shaper: composes jamo sequences into syllables the font draws and decomposes
 * syllables it lacks, enabling `ljmo`/`vjmo`/`tjmo` on jamo left apart; moves tone marks
 * before their syllable and gives a stray tone mark a dotted circle.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ShapingPlan } from "../plan.js";
import type { ShapingFont } from "../shaping-font.js";

import { GlyphInfo } from "../glyph-info.js";

import { DefaultShaper } from "./default.js";

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;
const L_BASE = 0x1100;
const V_BASE = 0x1161;
const T_BASE = 0x11a7;
const L_COUNT = 19;
const V_COUNT = 21;
const T_COUNT = 28;
const DOTTED_CIRCLE = 0x25cc;

/** Character categories: other, leading consonant, vowel, trailing consonant, syllables, tone mark. */
const CATEGORY = { X: 0, L: 1, V: 2, T: 3, LV: 4, LVT: 5, M: 6 };

/** State machine actions. */
const ACTION = { NONE: 0, DECOMPOSE: 1, COMPOSE: 2, TONE_MARK: 3, INVALID: 4 };

/** One transition: the action to take and the next state. */
type Transition = readonly [number, number];

/**
 * The syllable state machine by state then category. States: 0 start; 1 after `<L>`;
 * 2 after `<L,V>` or `<LV>`; 3 after `<L,V,T>` or `<LVT>`.
 */
const STATE_TABLE: readonly (readonly Transition[])[] = [
	[
		[ACTION.NONE, 0],
		[ACTION.NONE, 1],
		[ACTION.NONE, 0],
		[ACTION.NONE, 0],
		[ACTION.DECOMPOSE, 2],
		[ACTION.DECOMPOSE, 3],
		[ACTION.INVALID, 0],
	],
	[
		[ACTION.NONE, 0],
		[ACTION.NONE, 1],
		[ACTION.COMPOSE, 2],
		[ACTION.NONE, 0],
		[ACTION.DECOMPOSE, 2],
		[ACTION.DECOMPOSE, 3],
		[ACTION.INVALID, 0],
	],
	[
		[ACTION.NONE, 0],
		[ACTION.NONE, 1],
		[ACTION.NONE, 0],
		[ACTION.COMPOSE, 3],
		[ACTION.DECOMPOSE, 2],
		[ACTION.DECOMPOSE, 3],
		[ACTION.TONE_MARK, 0],
	],
	[
		[ACTION.NONE, 0],
		[ACTION.NONE, 1],
		[ACTION.NONE, 0],
		[ACTION.NONE, 0],
		[ACTION.DECOMPOSE, 2],
		[ACTION.DECOMPOSE, 3],
		[ACTION.TONE_MARK, 0],
	],
];

/** Shapes Hangul syllables and jamo; tone marks keep their advance. */
export class HangulShaper extends DefaultShaper {
	override zeroMarkWidths = "none" as const;

	/**
	 * The jamo features, local to the jamo the shaper leaves uncomposed.
	 *
	 * @param plan - The plan.
	 */
	override planFeatures(plan: ShapingPlan) {
		plan.add(["ljmo", "vjmo", "tjmo"], false);
	}

	/**
	 * Runs the syllable state machine over the buffer, composing, decomposing and reordering
	 * in place; Hangul text skips the default normalization, which this replaces.
	 *
	 * @param plan - The plan.
	 * @param glyphs - The buffer.
	 */
	override assignFeatures(plan: ShapingPlan, glyphs: GlyphInfo[]) {
		let font = plan.font;
		let state = 0;
		let index = 0;
		while (index < glyphs.length) {
			let codePoint = glyphs[index]?.codePoints[0] ?? 0;
			let [action, next] = STATE_TABLE[state]?.[category(codePoint)] ?? [ACTION.NONE, 0];
			state = next;
			if (action === ACTION.DECOMPOSE && font.glyphIndex(codePoint) === 0) {
				index = decompose(font, glyphs, index);
			} else if (action === ACTION.COMPOSE) {
				index = compose(font, glyphs, index);
			} else if (action === ACTION.TONE_MARK) {
				reorderToneMark(font, glyphs, index);
			} else if (action === ACTION.INVALID) {
				index = insertDottedCircle(font, glyphs, index);
			}
			index++;
		}
	}
}

/**
 * A character's category for the state machine, the extended jamo blocks included.
 *
 * @param codePoint - A code point.
 */
function category(codePoint: number): number {
	if ((codePoint >= 0x1100 && codePoint <= 0x115f) || (codePoint >= 0xa960 && codePoint <= 0xa97c))
		return CATEGORY.L;
	if ((codePoint >= 0x1160 && codePoint <= 0x11a7) || (codePoint >= 0xd7b0 && codePoint <= 0xd7c6))
		return CATEGORY.V;
	if ((codePoint >= 0x11a8 && codePoint <= 0x11ff) || (codePoint >= 0xd7cb && codePoint <= 0xd7fb))
		return CATEGORY.T;
	if (codePoint >= HANGUL_BASE && codePoint <= HANGUL_END) {
		return (codePoint - HANGUL_BASE) % T_COUNT === 0 ? CATEGORY.LV : CATEGORY.LVT;
	}
	if (codePoint === 0x302e || codePoint === 0x302f) return CATEGORY.M;
	return CATEGORY.X;
}

/**
 * A glyph for a code point that keeps another glyph's cluster and features.
 *
 * @param font - The shaping view.
 * @param codePoint - The character.
 * @param from - The glyph it stands in for.
 */
function glyphFor(font: ShapingFont, codePoint: number, from: GlyphInfo): GlyphInfo {
	return new GlyphInfo(font, font.glyphIndex(codePoint), [codePoint], from.cluster, from.features);
}

/**
 * Splits a syllable into its jamo with their jamo features, when the font draws every jamo.
 *
 * @param font - The shaping view.
 * @param glyphs - The buffer.
 * @param index - The syllable's index.
 * @returns The index of the last glyph that replaced it, `index` when left whole.
 */
function decompose(font: ShapingFont, glyphs: GlyphInfo[], index: number): number {
	let glyph = glyphs[index];
	if (glyph === undefined) return index;
	let syllable = (glyph.codePoints[0] ?? 0) - HANGUL_BASE;
	let t = T_BASE + (syllable % T_COUNT);
	let lv = Math.floor(syllable / T_COUNT);
	let l = L_BASE + Math.floor(lv / V_COUNT);
	let v = V_BASE + (lv % V_COUNT);
	let missing = [l, v, ...(t === T_BASE ? [] : [t])].some((jamo) => font.glyphIndex(jamo) === 0);
	if (missing) return index;
	let parts = [glyphFor(font, l, glyph), glyphFor(font, v, glyph)];
	parts[0]?.features.add("ljmo");
	parts[1]?.features.add("vjmo");
	if (t !== T_BASE) parts.push(glyphFor(font, t, glyph));
	parts[2]?.features.add("tjmo");
	glyphs.splice(index, 1, ...parts);
	return index + parts.length - 1;
}

/**
 * Composes `<L,V>`, `<L,V,T>` or `<LV,T>` ending at `index` into one syllable when its jamo
 * are the combining ones and the font draws the syllable; otherwise enables the jamo
 * features, splitting an `<LV>` back into jamo when its `T` could not join it.
 *
 * @param font - The shaping view.
 * @param glyphs - The buffer.
 * @param index - The index of the sequence's last jamo.
 * @returns The index of the sequence's last glyph after the change.
 */
function compose(font: ShapingFont, glyphs: GlyphInfo[], index: number): number {
	let glyph = glyphs[index];
	let previous = glyphs[index - 1];
	if (glyph === undefined || previous === undefined) return index;
	let type = category(glyph.codePoints[0] ?? 0);
	let previousType = category(previous.codePoints[0] ?? 0);
	let jamo = sequence(glyphs, index, type, previousType);
	let t = jamo.t?.codePoints[0] ?? T_BASE;
	if (jamo.lv !== null && (t === T_BASE || (t > T_BASE && t < T_BASE + T_COUNT))) {
		let composed = jamo.lv + (t - T_BASE);
		if (font.glyphIndex(composed) !== 0) {
			let length = previousType === CATEGORY.V ? 3 : 2;
			glyphs.splice(index - length + 1, length, glyphFor(font, composed, glyph));
			return index - length + 1;
		}
	}
	jamo.l?.features.add("ljmo");
	jamo.v?.features.add("vjmo");
	jamo.t?.features.add("tjmo");
	if (previousType === CATEGORY.LV) return decompose(font, glyphs, index - 1) + 1;
	return index;
}

/** The jamo of a sequence being composed, and the `<LV>` syllable they would start. */
interface JamoSequence {
	l: GlyphInfo | null;
	v: GlyphInfo | null;
	t: GlyphInfo | null;
	/** The `<LV>` syllable, `null` when the leading jamo are not the combining ones. */
	lv: number | null;
}

/**
 * Finds the jamo of the sequence ending at `index`.
 *
 * @param glyphs - The buffer.
 * @param index - The sequence's last jamo.
 * @param type - Its category.
 * @param previousType - The category of the glyph before it.
 */
function sequence(
	glyphs: GlyphInfo[],
	index: number,
	type: number,
	previousType: number,
): JamoSequence {
	let glyph = glyphs[index] ?? null;
	if (previousType === CATEGORY.LV && type === CATEGORY.T) {
		return { l: null, v: null, t: glyph, lv: glyphs[index - 1]?.codePoints[0] ?? null };
	}
	let l = glyphs[index - (type === CATEGORY.V ? 1 : 2)] ?? null;
	let v = type === CATEGORY.V ? glyph : (glyphs[index - 1] ?? null);
	let t = type === CATEGORY.V ? null : glyph;
	let lCode = l?.codePoints[0] ?? 0;
	let vCode = v?.codePoints[0] ?? 0;
	let combining =
		lCode >= L_BASE && lCode < L_BASE + L_COUNT && vCode >= V_BASE && vCode < V_BASE + V_COUNT;
	let lv = combining
		? HANGUL_BASE + ((lCode - L_BASE) * V_COUNT + (vCode - V_BASE)) * T_COUNT
		: null;
	return { l, v, t, lv };
}

/**
 * Moves a tone mark with an advance to the start of the syllable before it; a zero-width
 * tone mark stays after the syllable it overlaps.
 *
 * @param font - The shaping view.
 * @param glyphs - The buffer.
 * @param index - The tone mark's index.
 */
function reorderToneMark(font: ShapingFont, glyphs: GlyphInfo[], index: number) {
	let glyph = glyphs[index];
	if (glyph === undefined || font.font.advance(glyph.glyph) === 0) return;
	let previous = category(glyphs[index - 1]?.codePoints[0] ?? 0);
	let length = syllableLength(previous);
	glyphs.splice(index, 1);
	glyphs.splice(index - length, 0, glyph);
}

/**
 * How many glyphs the syllable ending in a glyph of this category spans.
 *
 * @param type - The category of the syllable's last glyph.
 */
function syllableLength(type: number): number {
	if (type === CATEGORY.V) return 2;
	if (type === CATEGORY.T) return 3;
	return 1;
}

/**
 * Gives a tone mark with no syllable a dotted circle to sit on: before a zero-width mark,
 * after one with an advance.
 *
 * @param font - The shaping view.
 * @param glyphs - The buffer.
 * @param index - The tone mark's index.
 * @returns The index of the later of the two glyphs.
 */
function insertDottedCircle(font: ShapingFont, glyphs: GlyphInfo[], index: number): number {
	let glyph = glyphs[index];
	if (glyph === undefined || font.glyphIndex(DOTTED_CIRCLE) === 0) return index;
	let at = font.font.advance(glyph.glyph) === 0 ? index : index + 1;
	glyphs.splice(at, 0, glyphFor(font, DOTTED_CIRCLE, glyph));
	return index + 1;
}
