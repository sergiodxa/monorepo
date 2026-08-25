/**
 * Pure geometry and fit checks for the battle creature status box.
 *
 * Keeps status-box and action-menu width/height math out of the drawing code
 * so it can be unit-tested: callers ask whether a string fits a width, or the
 * box height needed to keep every stacked row inside the frame.
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
 * Keeps adjacent action-menu columns clear of each other's labels, such as
 * "Creatures" and "Run".
 */
export function columnWidthFor(labels: readonly string[], padding: number): number {
	let widest = 0;
	for (let label of labels) widest = Math.max(widest, textWidth(label));
	return widest + padding;
}

/** Vertical layout of the status box rows, all offsets relative to the box top. */
export interface StatusBoxLayout {
	height: number;
	nameY: number;
	/** Y offset of the HP fraction row (only drawn when numbers are shown). */
	hpTextY: number;
	barY: number;
}

/**
 * Stacks the status-box rows so the HP number always sits inside the frame.
 *
 * `height` is sized to the last row's descent, so the box always contains the
 * full stack regardless of whether the HP-fraction row is shown.
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
