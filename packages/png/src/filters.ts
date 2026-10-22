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

/** The row above the first one, which PNG defines as all zeros; grown to the widest row seen. */
let zeros = new Uint8Array(0);

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

/** `previous`, or a zero row at least `length` bytes long standing in for the row above the first. */
function above(previous: Uint8Array | undefined, length: number): Uint8Array {
	if (previous) return previous;
	if (zeros.length < length) zeros = new Uint8Array(length);
	return zeros;
}

/**
 * Writes `row` filtered with `type` into `out` and returns the sum of the output bytes read
 * as signed values, the cost libpng's heuristic minimizes. Each type runs its own loop with
 * the Paeth predictor inlined and the first pixel, which has no left neighbour, split out,
 * since encoding tries all five on every row.
 */
export function filterRow(
	type: number,
	row: Uint8Array,
	previous: Uint8Array | undefined,
	bpp: number,
	out: Uint8Array,
): number {
	let length = row.length;
	let up = above(previous, length);
	let cost = 0;
	let value = 0;
	if (type === 0) {
		for (let index = 0; index < length; index++) {
			value = row[index] as number;
			out[index] = value;
			cost += value < 128 ? value : 256 - value;
		}
	} else if (type === 1) {
		for (let index = 0; index < length; index++) {
			value =
				index < bpp
					? (row[index] as number)
					: ((row[index] as number) - (row[index - bpp] as number)) & 0xff;
			out[index] = value;
			cost += value < 128 ? value : 256 - value;
		}
	} else if (type === 2) {
		for (let index = 0; index < length; index++) {
			value = ((row[index] as number) - (up[index] as number)) & 0xff;
			out[index] = value;
			cost += value < 128 ? value : 256 - value;
		}
	} else if (type === 3) {
		let first = Math.min(bpp, length);
		for (let index = 0; index < first; index++) {
			value = ((row[index] as number) - ((up[index] as number) >>> 1)) & 0xff;
			out[index] = value;
			cost += value < 128 ? value : 256 - value;
		}
		for (let index = first; index < length; index++) {
			value =
				((row[index] as number) - (((row[index - bpp] as number) + (up[index] as number)) >>> 1)) &
				0xff;
			out[index] = value;
			cost += value < 128 ? value : 256 - value;
		}
	} else {
		let first = Math.min(bpp, length);
		for (let index = 0; index < first; index++) {
			value = ((row[index] as number) - (up[index] as number)) & 0xff;
			out[index] = value;
			cost += value < 128 ? value : 256 - value;
		}
		for (let index = first; index < length; index++) {
			let left = row[index - bpp] as number;
			let above = up[index] as number;
			let upLeft = up[index - bpp] as number;
			let estimate = left + above - upLeft;
			let toLeft = estimate > left ? estimate - left : left - estimate;
			let toUp = estimate > above ? estimate - above : above - estimate;
			let toUpLeft = estimate > upLeft ? estimate - upLeft : upLeft - estimate;
			let predicted;
			if (toLeft <= toUp && toLeft <= toUpLeft) predicted = left;
			else if (toUp <= toUpLeft) predicted = above;
			else predicted = upLeft;
			value = ((row[index] as number) - predicted) & 0xff;
			out[index] = value;
			cost += value < 128 ? value : 256 - value;
		}
	}
	return cost;
}

/**
 * The filter type whose output has the lowest sum of bytes read as signed values, libpng's
 * heuristic, scored for all five types in one pass over the row so only the winner is then
 * written out. Ties go to the lower type, as trying the types in order would.
 */
export function chooseFilter(
	row: Uint8Array,
	previous: Uint8Array | undefined,
	bpp: number,
): number {
	let length = row.length;
	let up = above(previous, length);
	let none = 0;
	let sub = 0;
	let upCost = 0;
	let average = 0;
	let paethCost = 0;
	for (let index = 0; index < length; index++) {
		let current = row[index] as number;
		let hasLeft = index >= bpp;
		let left = hasLeft ? (row[index - bpp] as number) : 0;
		let above = up[index] as number;
		let upLeft = hasLeft ? (up[index - bpp] as number) : 0;
		let estimate = left + above - upLeft;
		let toLeft = estimate > left ? estimate - left : left - estimate;
		let toUp = estimate > above ? estimate - above : above - estimate;
		let toUpLeft = estimate > upLeft ? estimate - upLeft : upLeft - estimate;
		let predicted;
		if (toLeft <= toUp && toLeft <= toUpLeft) predicted = left;
		else if (toUp <= toUpLeft) predicted = above;
		else predicted = upLeft;
		let value = current;
		none += value < 128 ? value : 256 - value;
		value = (current - left) & 0xff;
		sub += value < 128 ? value : 256 - value;
		value = (current - above) & 0xff;
		upCost += value < 128 ? value : 256 - value;
		value = (current - ((left + above) >>> 1)) & 0xff;
		average += value < 128 ? value : 256 - value;
		value = (current - predicted) & 0xff;
		paethCost += value < 128 ? value : 256 - value;
	}
	let best = 0;
	let bestCost = none;
	if (sub < bestCost) [best, bestCost] = [1, sub];
	if (upCost < bestCost) [best, bestCost] = [2, upCost];
	if (average < bestCost) [best, bestCost] = [3, average];
	if (paethCost < bestCost) best = 4;
	return best;
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
	let length = row.length;
	let up = above(previous, length);
	if (type === 1) {
		for (let index = bpp; index < length; index++) {
			row[index] = ((row[index] as number) + (row[index - bpp] as number)) & 0xff;
		}
	} else if (type === 2) {
		for (let index = 0; index < length; index++) {
			row[index] = ((row[index] as number) + (up[index] as number)) & 0xff;
		}
	} else if (type === 3) {
		for (let index = 0; index < length; index++) {
			let left = index >= bpp ? (row[index - bpp] as number) : 0;
			row[index] = ((row[index] as number) + ((left + (up[index] as number)) >>> 1)) & 0xff;
		}
	} else {
		for (let index = 0; index < length; index++) {
			let hasLeft = index >= bpp;
			let left = hasLeft ? (row[index - bpp] as number) : 0;
			let upLeft = hasLeft ? (up[index - bpp] as number) : 0;
			row[index] = ((row[index] as number) + paeth(left, up[index] as number, upLeft)) & 0xff;
		}
	}
	return true;
}
