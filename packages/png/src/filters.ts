/**
 * The five scanline filters PNG defines (None, Sub, Up, Average, Paeth), applied when
 * encoding and reversed when decoding. Each predicts a byte from its left, upper and
 * upper-left neighbours `bpp` bytes back, where `bpp` is the bytes per pixel rounded up to one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** How many filter types PNG's filter method 0 defines; a byte at or past it is invalid. */
export const FILTER_COUNT = 5;

/**
 * The Paeth predictor: whichever of left, up and upper-left is closest to `left + up -
 * upLeft`, ties going to left, then up.
 */
function paeth(left: number, up: number, upLeft: number): number {
	let estimate = left + up - upLeft;
	let toLeft = Math.abs(estimate - left);
	let toUp = Math.abs(estimate - up);
	let toUpLeft = Math.abs(estimate - upLeft);
	if (toLeft <= toUp && toLeft <= toUpLeft) return left;
	if (toUp <= toUpLeft) return up;
	return upLeft;
}

/**
 * The prediction filter `type` makes for byte `index` of a row, from the reconstructed bytes
 * of the same row (`row`) and of the row above (`previous`, all zeros for the first row).
 */
function predict(
	type: number,
	row: Uint8Array,
	previous: Uint8Array | undefined,
	index: number,
	bpp: number,
): number {
	let left = index >= bpp ? (row[index - bpp] ?? 0) : 0;
	let up = previous?.[index] ?? 0;
	if (type === 1) return left;
	if (type === 2) return up;
	if (type === 3) return (left + up) >>> 1;
	if (type === 4) return paeth(left, up, index >= bpp ? (previous?.[index - bpp] ?? 0) : 0);
	return 0;
}

/**
 * Writes `row` filtered with `type` into `out` and returns the sum of the output bytes read
 * as signed values, the cost libpng's heuristic minimizes.
 */
export function filterRow(
	type: number,
	row: Uint8Array,
	previous: Uint8Array | undefined,
	bpp: number,
	out: Uint8Array,
): number {
	let cost = 0;
	for (let index = 0; index < row.length; index++) {
		let value = ((row[index] ?? 0) - predict(type, row, previous, index, bpp)) & 0xff;
		out[index] = value;
		cost += value < 128 ? value : 256 - value;
	}
	return cost;
}

/**
 * Reverses filter `type` on `row` in place, `previous` being the already reconstructed row
 * above. Returns false for a filter type PNG does not define, leaving the row untouched.
 */
export function unfilterRow(
	type: number,
	row: Uint8Array,
	previous: Uint8Array | undefined,
	bpp: number,
): boolean {
	if (type >= FILTER_COUNT) return false;
	if (type === 0) return true;
	for (let index = 0; index < row.length; index++) {
		row[index] = ((row[index] ?? 0) + predict(type, row, previous, index, bpp)) & 0xff;
	}
	return true;
}
