/**
 * Mark positioning for fonts without a GPOS table: each mark is placed against
 * its base's box by its Unicode combining class, stacking marks of one class away from the
 * base, so accents land over or under the letter instead of after it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { GlyphInfo } from "./glyph-info.js";
import type { GlyphPosition } from "./processor.js";
import type { ShapingFont } from "./shaping-font.js";

import { combiningClass } from "./unicode/properties.js";

/** The canonical combining classes placement reads, by their Unicode names. */
const CCC = {
	NOT_REORDERED: 0,
	ATTACHED_BELOW_LEFT: 200,
	ATTACHED_BELOW: 202,
	ATTACHED_ABOVE: 214,
	ATTACHED_ABOVE_RIGHT: 216,
	BELOW_LEFT: 218,
	BELOW: 220,
	BELOW_RIGHT: 222,
	ABOVE_LEFT: 228,
	ABOVE: 230,
	ABOVE_RIGHT: 232,
	DOUBLE_BELOW: 233,
	DOUBLE_ABOVE: 234,
};

/**
 * Where script-specific combining classes sit (Hebrew points, Arabic harakat, Thai, Lao and
 * Tibetan vowel signs), so they place like the positional class they draw at.
 */
const SCRIPT_CLASSES = new Map<number, number>([
	...[10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22].map((ccc) => [ccc, CCC.BELOW] as const),
	[23, CCC.ATTACHED_ABOVE],
	[24, CCC.ABOVE_RIGHT],
	[25, CCC.ABOVE_LEFT],
	[19, CCC.ABOVE_LEFT],
	[26, CCC.ABOVE],
	...[27, 28, 30, 31, 33, 34, 35, 36].map((ccc) => [ccc, CCC.ABOVE] as const),
	[29, CCC.BELOW],
	[32, CCC.BELOW],
	[103, CCC.BELOW_RIGHT],
	[107, CCC.ABOVE_RIGHT],
	[118, CCC.BELOW],
	[122, CCC.ABOVE],
	[129, CCC.BELOW],
	[132, CCC.BELOW],
	[130, CCC.ABOVE],
]);

/** Thai and Lao marks Unicode gives class 0 that still draw above or below their base. */
const THAI_LAO_CLASSES = new Map<number, number>([
	...[0x0e31, 0x0e34, 0x0e35, 0x0e36, 0x0e37, 0x0e47, 0x0e4c, 0x0e4d, 0x0e4e].map(
		(codePoint) => [codePoint, CCC.ABOVE_RIGHT] as const,
	),
	...[0x0eb1, 0x0eb4, 0x0eb5, 0x0eb6, 0x0eb7, 0x0ebb, 0x0ecc, 0x0ecd].map(
		(codePoint) => [codePoint, CCC.ABOVE] as const,
	),
	[0x0ebc, CCC.BELOW],
	[0x0e3a, CCC.BELOW_RIGHT],
]);

/** A box in font units, y up. */
interface Box {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

/**
 * The positional combining class a mark is placed by: script-specific classes map to the
 * position they draw at, and `0` means the mark keeps its own advance and offset.
 *
 * @param codePoint - The mark's first character.
 */
export function placementClass(codePoint: number): number {
	let thaiLao = THAI_LAO_CLASSES.get(codePoint);
	if (thaiLao !== undefined) return thaiLao;
	let ccc = combiningClass(codePoint);
	return SCRIPT_CLASSES.get(ccc) ?? ccc;
}

/**
 * Positions every base-and-marks cluster of a buffer in logical order. Offsets are relative
 * to the pen after the base for left-to-right runs and before it for right-to-left ones,
 * so they hold once a right-to-left run is reversed for display.
 *
 * @param font - The shaping view.
 * @param glyphs - The buffer, in logical order.
 * @param positions - Its positions, changed in place.
 * @param direction - The run's direction.
 */
export function positionMarksFallback(
	font: ShapingFont,
	glyphs: readonly GlyphInfo[],
	positions: GlyphPosition[],
	direction: "ltr" | "rtl",
) {
	let start = 0;
	while (start < glyphs.length) {
		let end = start;
		while (end + 1 < glyphs.length && glyphs[end + 1]?.isMark === true) end++;
		if (end > start && glyphs[start]?.isMark === false) {
			positionCluster(font, glyphs, positions, start, end, direction);
		}
		start = end + 1;
	}
}

/**
 * Places the marks after one base. The base's box spans its advance horizontally and its
 * outline vertically; a ligature's marks go over its last component. Marks of a new class
 * start again from the base, and each placed mark grows the box it was stacked onto.
 *
 * @param font - The shaping view.
 * @param glyphs - The buffer.
 * @param positions - Its positions.
 * @param start - Buffer index of the base.
 * @param end - Buffer index of the cluster's last mark.
 * @param direction - The run's direction.
 */
function positionCluster(
	font: ShapingFont,
	glyphs: readonly GlyphInfo[],
	positions: GlyphPosition[],
	start: number,
	end: number,
	direction: "ltr" | "rtl",
) {
	let base = glyphs[start];
	let basePosition = positions[start];
	if (base === undefined || basePosition === undefined) return;
	let width = font.font.advance(base.glyph);
	let baseCBox = font.font.glyphCBox(base.glyph);
	let baseBox: Box = { minX: 0, minY: baseCBox.yMin, maxX: width, maxY: baseCBox.yMax };
	let components = base.codePoints.length;
	if (components > 1) {
		baseBox.minX = Math.trunc(((components - 1) * width) / components);
		baseBox.maxX = baseBox.minX + Math.trunc(width / components);
	}
	let forward = direction !== "rtl";
	let xOffset = forward ? -basePosition.xAdvance : 0;
	let yOffset = 0;
	let gap = Math.trunc(font.font.unitsPerEm / 16);
	let box: Box = { ...baseBox };
	let lastClass: number | null = null;
	for (let index = start + 1; index <= end; index++) {
		let mark = glyphs[index];
		let position = positions[index];
		if (mark === undefined || position === undefined) continue;
		let ccc = placementClass(mark.codePoints[0] ?? 0);
		if (ccc === CCC.NOT_REORDERED) {
			xOffset += forward ? -position.xAdvance : position.xAdvance;
			yOffset += forward ? -position.yAdvance : position.yAdvance;
			continue;
		}
		if (ccc !== lastClass) {
			box = { ...baseBox };
			lastClass = ccc;
		}
		let cbox = font.font.glyphCBox(mark.glyph);
		let markBox: Box = { minX: cbox.xMin, minY: cbox.yMin, maxX: cbox.xMax, maxY: cbox.yMax };
		position.xOffset = horizontalOffset(ccc, box, markBox) + xOffset;
		position.yOffset = stackVertically(ccc, box, markBox, gap) + yOffset;
		position.xAdvance = 0;
		position.yAdvance = 0;
	}
}

/**
 * Where a mark sits across its base: double marks straddle the box's right edge, left and
 * right classes align with that edge, every other class centers on the box.
 *
 * @param ccc - The mark's placement class.
 * @param box - The box the mark is placed against.
 * @param mark - The mark's control box.
 */
function horizontalOffset(ccc: number, box: Box, mark: Box): number {
	let markWidth = mark.maxX - mark.minX;
	switch (ccc) {
		case CCC.DOUBLE_ABOVE:
		case CCC.DOUBLE_BELOW:
			return box.maxX - Math.trunc(markWidth / 2) - mark.minX;
		case CCC.ATTACHED_BELOW_LEFT:
		case CCC.BELOW_LEFT:
		case CCC.ABOVE_LEFT:
			return box.minX - mark.minX;
		case CCC.ATTACHED_ABOVE_RIGHT:
		case CCC.BELOW_RIGHT:
		case CCC.ABOVE_RIGHT:
			return box.maxX - mark.maxX;
		default:
			return box.minX + Math.trunc((box.maxX - box.minX - markWidth) / 2) - mark.minX;
	}
}

/**
 * Where a mark sits vertically, growing `box` past it so the next mark of its class stacks
 * beyond it. Detached marks keep a gap from what they stack on; a below mark never moves up
 * and an above mark moves down at most half the distance its box would ask for.
 *
 * @param ccc - The mark's placement class.
 * @param box - The box the mark stacks onto, grown in place.
 * @param mark - The mark's control box.
 * @param gap - The gap kept by detached marks.
 * @returns The mark's y offset, `0` for a class that is neither above nor below.
 */
function stackVertically(ccc: number, box: Box, mark: Box, gap: number): number {
	let height = mark.maxY - mark.minY;
	let below = [CCC.DOUBLE_BELOW, CCC.BELOW_LEFT, CCC.BELOW, CCC.BELOW_RIGHT];
	let above = [CCC.DOUBLE_ABOVE, CCC.ABOVE_LEFT, CCC.ABOVE, CCC.ABOVE_RIGHT];
	if (below.includes(ccc) || ccc === CCC.ATTACHED_BELOW_LEFT || ccc === CCC.ATTACHED_BELOW) {
		if (below.includes(ccc)) box.minY -= gap;
		let offset = box.minY - mark.maxY;
		if (offset > 0) {
			box.minY -= offset;
			offset = 0;
		}
		box.minY -= height;
		return offset;
	}
	if (above.includes(ccc) || ccc === CCC.ATTACHED_ABOVE || ccc === CCC.ATTACHED_ABOVE_RIGHT) {
		if (above.includes(ccc)) box.maxY += gap;
		let offset = box.maxY - mark.minY;
		if (offset < 0) {
			let correction = -Math.trunc(offset / 2);
			box.maxY += correction;
			offset += correction;
		}
		box.maxY += height;
		return offset;
	}
	return 0;
}
