/**
 * Builds the module grid for one symbol: function patterns, the codewords in the zigzag
 * placement order, the mask, and the format and version information. Each mask's penalty
 * is scored with the four rules of ISO/IEC 18004 §7.8.3.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { QrLevel } from "./encode.js";

import { ALIGNMENT_POSITIONS, LEVEL_FORMAT_BITS } from "./tables.js";

/** A square grid of modules, row-major, with a parallel record of which belong to function patterns. */
export interface Matrix {
	size: number;
	dark: Uint8Array;
	reserved: Uint8Array;
}

/** Penalty weights for runs (N1), 2×2 blocks (N2), finder-like patterns (N3) and dark balance (N4). */
const PENALTY_N1 = 3;
const PENALTY_N2 = 3;
const PENALTY_N3 = 40;
const PENALTY_N4 = 10;

/**
 * A grid for `version` with every function pattern drawn and the format and version areas
 * reserved, ready for `placeCodewords`.
 */
export function functionPatterns(version: number, level: QrLevel): Matrix {
	let size = version * 4 + 17;
	let matrix: Matrix = {
		size,
		dark: new Uint8Array(size * size),
		reserved: new Uint8Array(size * size),
	};

	for (let index = 0; index < size; index++) {
		setFunction(matrix, 6, index, index % 2 === 0);
		setFunction(matrix, index, 6, index % 2 === 0);
	}

	drawFinder(matrix, 3, 3);
	drawFinder(matrix, size - 4, 3);
	drawFinder(matrix, 3, size - 4);

	let positions = ALIGNMENT_POSITIONS[version] ?? [];
	let last = positions.length - 1;
	for (let row = 0; row <= last; row++) {
		for (let column = 0; column <= last; column++) {
			let overlapsFinder =
				(row === 0 && column === 0) ||
				(row === 0 && column === last) ||
				(row === last && column === 0);
			if (!overlapsFinder) drawAlignment(matrix, positions[column] ?? 0, positions[row] ?? 0);
		}
	}

	drawFormatBits(matrix, level, 0);
	drawVersion(matrix, version);
	return matrix;
}

/**
 * Place the codewords bit by bit in the standard's order: column pairs from the right,
 * alternating upward and downward, skipping function modules and the vertical timing column.
 */
export function placeCodewords(matrix: Matrix, codewords: Uint8Array): void {
	let { size } = matrix;
	let bit = 0;
	let totalBits = codewords.length * 8;
	for (let right = size - 1; right >= 1; right -= 2) {
		if (right === 6) right = 5;
		let upward = ((right + 1) & 2) === 0;
		for (let step = 0; step < size; step++) {
			let y = upward ? size - 1 - step : step;
			for (let offset = 0; offset < 2; offset++) {
				let index = y * size + right - offset;
				if (matrix.reserved[index] || bit >= totalBits) continue;
				let byte = codewords[bit >>> 3] ?? 0;
				matrix.dark[index] = (byte >>> (7 - (bit & 7))) & 1;
				bit++;
			}
		}
	}
}

/** Flip every data module the mask pattern selects; applying the same mask again undoes it. */
export function applyMask(matrix: Matrix, mask: number): void {
	let { size } = matrix;
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			let index = y * size + x;
			if (!matrix.reserved[index] && maskSelects(mask, x, y))
				matrix.dark[index] = (matrix.dark[index] ?? 0) ^ 1;
		}
	}
}

/**
 * Write the format information into both copies around the finders, and set the
 * always-dark module beside the bottom-left finder.
 */
export function drawFormatBits(matrix: Matrix, level: QrLevel, mask: number): void {
	let { size } = matrix;
	let bits = formatBits(level, mask);

	for (let index = 0; index <= 5; index++) setFunction(matrix, 8, index, bitAt(bits, index));
	setFunction(matrix, 8, 7, bitAt(bits, 6));
	setFunction(matrix, 8, 8, bitAt(bits, 7));
	setFunction(matrix, 7, 8, bitAt(bits, 8));
	for (let index = 9; index < 15; index++) setFunction(matrix, 14 - index, 8, bitAt(bits, index));

	for (let index = 0; index < 8; index++)
		setFunction(matrix, size - 1 - index, 8, bitAt(bits, index));
	for (let index = 8; index < 15; index++)
		setFunction(matrix, 8, size - 15 + index, bitAt(bits, index));
	setFunction(matrix, 8, size - 8, true);
}

/** The level and mask as a BCH(15,5) code, XORed with 0x5412 so no format reads all light. */
export function formatBits(level: QrLevel, mask: number): number {
	let data = (LEVEL_FORMAT_BITS[level] << 3) | mask;
	let remainder = data;
	for (let step = 0; step < 10; step++) remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
	return ((data << 10) | remainder) ^ 0x5412;
}

/** The version as a BCH(18,6) code, which versions 7 and up carry. */
export function versionBits(version: number): number {
	let remainder = version;
	for (let step = 0; step < 12; step++)
		remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25);
	return (version << 12) | remainder;
}

/**
 * The mask's penalty score. Runs and finder-like patterns are counted per row and column,
 * with the light quiet zone counted as part of the first and last runs, so a pattern
 * touching the edge scores like one surrounded by light modules.
 */
export function penaltyScore(matrix: Matrix): number {
	let { size, dark } = matrix;
	let score = 0;

	for (let line = 0; line < size; line++) {
		score += linePenalty(size, (position) => dark[line * size + position] ?? 0);
		score += linePenalty(size, (position) => dark[position * size + line] ?? 0);
	}

	for (let y = 0; y < size - 1; y++) {
		for (let x = 0; x < size - 1; x++) {
			let color = dark[y * size + x];
			if (
				color === dark[y * size + x + 1] &&
				color === dark[(y + 1) * size + x] &&
				color === dark[(y + 1) * size + x + 1]
			) {
				score += PENALTY_N2;
			}
		}
	}

	let darkCount = 0;
	for (let module of dark) darkCount += module;
	let total = size * size;
	let k = Math.ceil(Math.abs(darkCount * 20 - total * 10) / total) - 1;
	return score + k * PENALTY_N4;
}

/** Version information in the two 6×3 blocks, from version 7. */
function drawVersion(matrix: Matrix, version: number): void {
	if (version < 7) return;
	let bits = versionBits(version);
	for (let index = 0; index < 18; index++) {
		let a = matrix.size - 11 + (index % 3);
		let b = Math.floor(index / 3);
		setFunction(matrix, a, b, bitAt(bits, index));
		setFunction(matrix, b, a, bitAt(bits, index));
	}
}

/** A 7×7 finder centred on (x, y) with its light separator, clipped to the grid. */
function drawFinder(matrix: Matrix, x: number, y: number): void {
	for (let dy = -4; dy <= 4; dy++) {
		for (let dx = -4; dx <= 4; dx++) {
			let distance = Math.max(Math.abs(dx), Math.abs(dy));
			let xx = x + dx;
			let yy = y + dy;
			if (xx >= 0 && xx < matrix.size && yy >= 0 && yy < matrix.size) {
				setFunction(matrix, xx, yy, distance !== 2 && distance !== 4);
			}
		}
	}
}

/** A 5×5 alignment pattern centred on (x, y). */
function drawAlignment(matrix: Matrix, x: number, y: number): void {
	for (let dy = -2; dy <= 2; dy++) {
		for (let dx = -2; dx <= 2; dx++) {
			setFunction(matrix, x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
		}
	}
}

/** Set a module and mark it reserved, so data placement and masking leave it alone. */
function setFunction(matrix: Matrix, x: number, y: number, dark: boolean): void {
	let index = y * matrix.size + x;
	matrix.dark[index] = dark ? 1 : 0;
	matrix.reserved[index] = 1;
}

/** Whether mask pattern `mask` inverts the module at (x, y), per ISO/IEC 18004 Table 10. */
function maskSelects(mask: number, x: number, y: number): boolean {
	switch (mask) {
		case 0:
			return (x + y) % 2 === 0;
		case 1:
			return y % 2 === 0;
		case 2:
			return x % 3 === 0;
		case 3:
			return (x + y) % 3 === 0;
		case 4:
			return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
		case 5:
			return ((x * y) % 2) + ((x * y) % 3) === 0;
		case 6:
			return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
		default:
			return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
	}
}

/**
 * N1 and N3 for one row or column. N1 scores each run of five or more same-colored modules;
 * N3 scores each 1:1:3:1:1 dark-light pattern with four light modules on either side, tracked
 * through the lengths of the last seven runs.
 */
function linePenalty(size: number, moduleAt: (position: number) => number): number {
	let score = 0;
	let runColor = 0;
	let runLength = 0;
	let history = [0, 0, 0, 0, 0, 0, 0];

	/** Record a finished run; the first run absorbs the light quiet zone before the line. */
	function pushRun(length: number) {
		if (history[0] === 0) length += size;
		history.pop();
		history.unshift(length);
	}

	/** Finder-like patterns ending at the newest light run, counting either side's margin. */
	function finderPatterns(): number {
		let [latest = 0, a = 0, b = 0, c = 0, d = 0, e = 0, earliest = 0] = history;
		let core = a > 0 && b === a && c === a * 3 && d === a && e === a;
		return (
			(core && latest >= a * 4 && earliest >= a ? 1 : 0) +
			(core && earliest >= a * 4 && latest >= a ? 1 : 0)
		);
	}

	for (let position = 0; position < size; position++) {
		let color = moduleAt(position);
		if (color === runColor) {
			runLength++;
			if (runLength === 5) score += PENALTY_N1;
			else if (runLength > 5) score++;
		} else {
			pushRun(runLength);
			if (!runColor) score += finderPatterns() * PENALTY_N3;
			runColor = color;
			runLength = 1;
		}
	}

	if (runColor) {
		pushRun(runLength);
		runLength = 0;
	}
	pushRun(runLength + size);
	return score + finderPatterns() * PENALTY_N3;
}

/** Bit `index` of `value` as a boolean. */
function bitAt(value: number, index: number): boolean {
	return ((value >>> index) & 1) !== 0;
}
