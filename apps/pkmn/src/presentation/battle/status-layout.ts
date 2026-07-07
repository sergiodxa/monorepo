/**
 * Pure geometry and fit checks for the battle creature status box.
 *
 * The status window packs a name, a level, an HP bar, and (for the player's
 * creature) an HP fraction into one small panel, and the root action menu packs
 * four labels into a two-column grid. Both must fit inside a fixed pixel width at
 * the presentation's bitmap metrics, so this module keeps the width math out of
 * the drawing code where it cannot be unit-tested. Callers ask whether a string
 * fits a given inner width, or for the exact box height needed to stack the status
 * rows without the HP number spilling below the frame; the drawing code then just
 * places text at the returned coordinates.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { GLYPH_ADVANCE, GLYPH_HEIGHT } from "../render/font";

/** Rendered pixel width of a string at the fixed bitmap metrics. */
export function textWidth(text: string): number {
	return text.length * GLYPH_ADVANCE;
}

/** Whether `text` fits within `available` pixels of horizontal space. */
export function fitsWidth(text: string, available: number): boolean {
	return textWidth(text) <= available;
}

/** The HP fraction string a bar of `current`/`max` HP draws (e.g. "12/12"). */
export function hpText(current: number, max: number): string {
	return `${current}/${max}`;
}

/**
 * Smallest even column width that fits the widest of `labels` with padding.
 *
 * The root action menu draws labels in fixed columns; a column narrower than its
 * longest label makes adjacent labels collide ("CreaturesRun"). Given the labels
 * and the horizontal padding a column reserves around its text, this returns the
 * column width wide enough for the longest label so no two ever overlap.
 */
export function columnWidthFor(labels: readonly string[], padding: number): number {
	let widest = 0;
	for (let label of labels) widest = Math.max(widest, textWidth(label));
	return widest + padding;
}

/** Vertical layout of the status box rows, all offsets relative to the box top. */
export interface StatusBoxLayout {
	/** Total box height in pixels. */
	height: number;
	/** Y offset of the name/level row. */
	nameY: number;
	/** Y offset of the HP fraction row (only drawn when numbers are shown). */
	hpTextY: number;
	/** Y offset of the HP bar. */
	barY: number;
}

/**
 * Stacks the status-box rows so the HP number always sits inside the frame.
 *
 * Rows are name, then (when numbers are shown) the HP fraction, then the HP bar,
 * each `GLYPH_HEIGHT` tall with a little leading, plus top and bottom padding. The
 * returned `height` is exactly enough to contain the last row's descent, so the HP
 * text can never overflow below the box the way a fixed short height caused.
 */
export function statusBoxLayout(showNumbers: boolean, barHeight: number): StatusBoxLayout {
	let padTop = 3;
	let padBottom = 3;
	let rowGap = 2;

	let nameY = padTop;
	let afterName = nameY + GLYPH_HEIGHT + rowGap;
	let hpTextY = showNumbers ? afterName : afterName;
	let afterHpText = showNumbers ? hpTextY + GLYPH_HEIGHT + rowGap : afterName;
	let barY = afterHpText;
	let height = barY + barHeight + padBottom;

	return { height, nameY, hpTextY, barY };
}
