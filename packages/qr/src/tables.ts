/**
 * The per-version constants of ISO/IEC 18004 as literal tables: error correction block
 * layout and alignment pattern centres. Written out rather than derived, so importing the
 * package does no work at module scope.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { QrLevel } from "./encode.js";

/** The levels from least to most correction, the order `boostLevel` climbs them in. */
export const LEVELS: readonly QrLevel[] = ["L", "M", "Q", "H"];

/** The two bits each level writes into the format information. */
export const LEVEL_FORMAT_BITS: Readonly<Record<QrLevel, number>> = { L: 1, M: 0, Q: 3, H: 2 };

/** Error correction codewords in every block, indexed by version; index 0 is unused. */
export const ECC_CODEWORDS_PER_BLOCK: Readonly<Record<QrLevel, readonly number[]>> = {
	L: [
		0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30,
		30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
	],
	M: [
		0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28,
		28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
	],
	Q: [
		0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30,
		30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
	],
	H: [
		0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30,
		30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
	],
};

/** Error correction blocks the data is split into, indexed by version; index 0 is unused. */
export const ERROR_CORRECTION_BLOCKS: Readonly<Record<QrLevel, readonly number[]>> = {
	L: [
		0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14,
		15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25,
	],
	M: [
		0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25,
		26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49,
	],
	Q: [
		0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34,
		34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68,
	],
	H: [
		0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37,
		40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81,
	],
};

/**
 * Alignment pattern centre coordinates, indexed by version; index 0 is unused. A pattern
 * sits at every pairing of two coordinates except the three that overlap a finder.
 */
export const ALIGNMENT_POSITIONS: readonly (readonly number[])[] = [
	[],
	[],
	[6, 18],
	[6, 22],
	[6, 26],
	[6, 30],
	[6, 34],
	[6, 22, 38],
	[6, 24, 42],
	[6, 26, 46],
	[6, 28, 50],
	[6, 30, 54],
	[6, 32, 58],
	[6, 34, 62],
	[6, 26, 46, 66],
	[6, 26, 48, 70],
	[6, 26, 50, 74],
	[6, 30, 54, 78],
	[6, 30, 56, 82],
	[6, 30, 58, 86],
	[6, 34, 62, 90],
	[6, 28, 50, 72, 94],
	[6, 26, 50, 74, 98],
	[6, 30, 54, 78, 102],
	[6, 28, 54, 80, 106],
	[6, 32, 58, 84, 110],
	[6, 30, 58, 86, 114],
	[6, 34, 62, 90, 118],
	[6, 26, 50, 74, 98, 122],
	[6, 30, 54, 78, 102, 126],
	[6, 26, 52, 78, 104, 130],
	[6, 30, 56, 82, 108, 134],
	[6, 34, 60, 86, 112, 138],
	[6, 30, 58, 86, 114, 142],
	[6, 34, 62, 90, 118, 146],
	[6, 30, 54, 78, 102, 126, 150],
	[6, 24, 50, 76, 102, 128, 154],
	[6, 28, 54, 80, 106, 132, 158],
	[6, 32, 58, 84, 110, 136, 162],
	[6, 26, 54, 82, 110, 138, 166],
	[6, 30, 58, 86, 114, 142, 170],
];

/**
 * Modules left for data and error correction once every function pattern is drawn,
 * including the remainder bits that do not fill a whole codeword.
 */
export function rawDataModules(version: number): number {
	let modules = (16 * version + 128) * version + 64;
	if (version >= 2) {
		let alignments = Math.floor(version / 7) + 2;
		modules -= (25 * alignments - 10) * alignments - 55;
		if (version >= 7) modules -= 36;
	}
	return modules;
}

/** Codewords that carry data, once the level's error correction is set aside. */
export function dataCodewordCount(version: number, level: QrLevel): number {
	return (
		Math.floor(rawDataModules(version) / 8) -
		eccCodewordsPerBlock(version, level) * errorCorrectionBlocks(version, level)
	);
}

/** Error correction codewords in each block at `version` and `level`. */
export function eccCodewordsPerBlock(version: number, level: QrLevel): number {
	return ECC_CODEWORDS_PER_BLOCK[level][version] ?? 0;
}

/** Blocks the codewords split into at `version` and `level`. */
export function errorCorrectionBlocks(version: number, level: QrLevel): number {
	return ERROR_CORRECTION_BLOCKS[level][version] ?? 0;
}
