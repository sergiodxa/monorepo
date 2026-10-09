/**
 * Text metrics without a font: labels are measured from per-character width
 * classes of a typical sans-serif face, erring wide so a box always holds its
 * label whichever system font the reader's browser picks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Size of every label, in SVG user units. */
export const FONT_SIZE = 14;

/** Distance between the baselines of a multi-line label. */
export const LINE_HEIGHT = 19;

/** Glyphs narrower than a lowercase letter, in em. */
const NARROW = new Set(" ilj.,:;'|!I`");

/** Glyphs between narrow and a lowercase letter, in em. */
const SLIM = new Set('frt()[]{}-/\\"*');

/** Glyphs wider than an uppercase letter, in em. */
const WIDE = new Set("mwMW@%");

/** Styling a label can carry, which widens it. */
export interface TextStyle {
	bold?: boolean;
}

/**
 * Splits a label on the `<br>` tags Mermaid uses for line breaks, in any of
 * their spellings.
 *
 * @param label - Label text as written
 * @returns Its lines, trimmed
 */
export function splitLines(label: string): string[] {
	return label.split(/<br\s*\/?>/i).map((line) => line.trim());
}

/**
 * @param text - One line of text
 * @param style - Whether it renders bold
 * @returns Its estimated width at {@link FONT_SIZE}
 */
export function textWidth(text: string, style: TextStyle = {}): number {
	let em = 0;
	for (let character of text) em += glyphWidth(character);
	return em * FONT_SIZE * (style.bold ? 1.08 : 1);
}

/**
 * @param lines - The lines of a label
 * @param style - Whether they render bold
 * @returns The width of the widest line and the height of all of them
 */
export function blockSize(
	lines: readonly string[],
	style: TextStyle = {},
): { width: number; height: number } {
	let width = Math.max(0, ...lines.map((line) => textWidth(line, style)));
	return { width, height: lines.length * LINE_HEIGHT };
}

/** The width of one glyph in em, with ideographs and emoji counted as a full em. */
function glyphWidth(character: string): number {
	if (NARROW.has(character)) return 0.3;
	if (SLIM.has(character)) return 0.4;
	if (WIDE.has(character)) return 0.9;
	if (/[A-Z]/.test(character)) return 0.7;
	if (/[a-z0-9]/.test(character)) return 0.58;
	if ((character.codePointAt(0) ?? 0) >= 0x2e80) return 1;
	return 0.65;
}
