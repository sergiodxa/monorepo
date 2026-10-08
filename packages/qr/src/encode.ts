/**
 * Encodes text or bytes as a QR Code Model 2 symbol: picks the smallest version that holds
 * the optimally segmented data, adds Reed–Solomon error correction, and chooses the mask
 * with the lowest penalty. Every failure is a `Result`, so a caller decides what to render.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { Matrix } from "./matrix.js";
import type { Segment } from "./segment.js";
import type { SvgPath, SvgPathOptions } from "./svg-path.js";

import {
	applyMask,
	drawFormatBits,
	functionPatterns,
	penaltyScore,
	placeCodewords,
} from "./matrix.js";
import { reedSolomonDivisor, reedSolomonRemainder } from "./reed-solomon.js";
import { appendBits, bytesSegments, textSegments, totalBits, writeSegments } from "./segment.js";
import { svgPath } from "./svg-path.js";
import {
	dataCodewordCount,
	eccCodewordsPerBlock,
	errorCorrectionBlocks,
	LEVELS,
	rawDataModules,
} from "./tables.js";

/** Error correction level: `L` recovers about 7% of codewords, `M` 15%, `Q` 25%, `H` 30%. */
export type QrLevel = "L" | "M" | "Q" | "H";

/** How `QR.encode` chooses the symbol's version, level and mask. */
export interface QrOptions {
	/**
	 * The minimum error correction level.
	 *
	 * @default "M"
	 */
	level?: QrLevel;
	/**
	 * The smallest version to try, 1–40.
	 *
	 * @default 1
	 */
	minVersion?: number;
	/**
	 * The largest version to try, 1–40; data that does not fit it fails with `too-long`.
	 *
	 * @default 40
	 */
	maxVersion?: number;
	/** A fixed mask, 0–7; omitted, every mask is scored and the lowest penalty wins. */
	mask?: number;
	/**
	 * Raise the level as far as the chosen version still holds the data, since the extra
	 * correction costs no modules.
	 *
	 * @default true
	 */
	boostLevel?: boolean;
}

/** One complete QR code, the matrix a renderer draws. */
export interface QrSymbol {
	/** 1–40; the symbol is `17 + 4 * version` modules a side. */
	readonly version: number;
	/** The level actually applied, which `boostLevel` may have raised. */
	readonly level: QrLevel;
	readonly mask: number;
	/** Modules a side, quiet zone excluded. */
	readonly size: number;
	/** Coordinates outside the symbol answer `false`, so a renderer draws the quiet zone by reading past the edge. */
	isDark(x: number, y: number): boolean;
}

/**
 * Why `QR.encode` produced no symbol. A `too-long` error carries `bits`, the data's length
 * and the capacity at `maxVersion`, so a caller can say how much to cut.
 */
export class QrError extends Error {
	override name = "QrError";

	/**
	 * @param code - What went wrong
	 * @param message - A description for logs
	 * @param bits - For `too-long`, the bits the data needs and the bits `maxVersion` holds
	 */
	constructor(
		readonly code: QrError.Code,
		message: string,
		readonly bits?: QrError.Bits,
	) {
		super(message);
	}
}

/** The types {@link QrError} carries. */
export namespace QrError {
	/** `too-long` when the data exceeds `maxVersion` at `level`, `invalid-options` for an out-of-range option. */
	export type Code = "too-long" | "invalid-options";

	/** The data's size against the largest symbol allowed. */
	export interface Bits {
		needed: number;
		available: number;
	}
}

/** Encodes QR Code Model 2 symbols; every failure is a `Result`, so a caller decides what to render. */
export class QR {
	/**
	 * Encode `data` as a QR symbol. A string is split into numeric, alphanumeric and UTF-8
	 * byte segments with the fewest bits; a `Uint8Array` is one byte-mode run.
	 *
	 * @param data - Text, or bytes for a payload that is not text
	 * @param options - Level, version range, mask and level boost
	 * @returns The symbol, or a `QrError` when the options are out of range or the data does not fit
	 * @example QR.encode("https://example.com/device?user_code=WDJB-MJHT")
	 * @example QR.encode(uri, { level: "Q", maxVersion: 10 })
	 */
	static encode(data: string | Uint8Array, options: QrOptions = {}): Result<QrSymbol, QrError> {
		let { level = "M", minVersion = 1, maxVersion = 40, mask, boostLevel = true } = options;

		if (!isVersion(minVersion) || !isVersion(maxVersion) || minVersion > maxVersion) {
			return failure(
				new QrError(
					"invalid-options",
					"minVersion and maxVersion must be integers in 1–40, in order",
				),
			);
		}
		if (mask !== undefined && !(Number.isInteger(mask) && mask >= 0 && mask <= 7)) {
			return failure(new QrError("invalid-options", "mask must be an integer in 0–7"));
		}
		if (!LEVELS.includes(level)) {
			return failure(new QrError("invalid-options", "level must be one of L, M, Q or H"));
		}

		let segments: Segment[] = [];
		let usedBits = 0;
		let version = minVersion;
		for (; ; version++) {
			if (version === minVersion || version === 10 || version === 27) {
				segments =
					typeof data === "string" ? textSegments(data, version) : bytesSegments(data, version);
			}
			usedBits = totalBits(segments, version);
			let capacity = dataCodewordCount(version, level) * 8;
			if (usedBits <= capacity) break;
			if (version >= maxVersion) {
				return failure(
					new QrError(
						"too-long",
						`The data needs ${usedBits} bits; version ${version}-${level} holds ${capacity}`,
						{
							needed: usedBits,
							available: capacity,
						},
					),
				);
			}
		}

		if (boostLevel) {
			for (let candidate of LEVELS.slice(LEVELS.indexOf(level) + 1)) {
				if (usedBits <= dataCodewordCount(version, candidate) * 8) level = candidate;
			}
		}

		let codewords = interleave(dataCodewords(segments, version, level), version, level);
		let matrix = functionPatterns(version, level);
		placeCodewords(matrix, codewords);

		let chosen = mask ?? bestMask(matrix, level);
		applyMask(matrix, chosen);
		drawFormatBits(matrix, level, chosen);

		let { size, dark } = matrix;
		return success({
			version,
			level,
			mask: chosen,
			size,
			isDark(x, y) {
				return x >= 0 && x < size && y >= 0 && y < size && dark[y * size + x] === 1;
			},
		});
	}

	/**
	 * Path data for `symbol`: one rectangle per horizontal run of dark modules, one unit per
	 * module, offset by `margin` so the viewBox includes the quiet zone. It returns attribute
	 * values, so the caller's renderer owns the markup.
	 *
	 * @param symbol - A symbol from `QR.encode`
	 * @param options - The quiet zone width
	 * @returns The path, its viewBox and its side length in modules
	 * @example let { d, viewBox } = QR.toSVGPath(symbol);
	 */
	static toSVGPath(symbol: QrSymbol, options: SvgPathOptions = {}): SvgPath {
		return svgPath(symbol, options);
	}
}

/**
 * The data codewords for `version` and `level`: the segments, a terminator of up to four
 * zero bits, zero bits to a byte boundary, then alternating 0xEC and 0x11 pad bytes.
 */
export function dataCodewords(
	segments: readonly Segment[],
	version: number,
	level: QrLevel,
): Uint8Array {
	let bits = writeSegments(segments, version);
	let capacity = dataCodewordCount(version, level) * 8;
	appendBits(bits, 0, Math.min(4, capacity - bits.length));
	appendBits(bits, 0, (8 - (bits.length % 8)) % 8);
	for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) appendBits(bits, pad, 8);

	let codewords = new Uint8Array(capacity / 8);
	for (let index = 0; index < bits.length; index++) {
		codewords[index >>> 3] =
			(codewords[index >>> 3] ?? 0) | ((bits[index] ?? 0) << (7 - (index & 7)));
	}
	return codewords;
}

/**
 * Split the data into the level's blocks, append each block's error correction, and
 * interleave: the nth data codeword of every block in turn, then the nth correction codeword.
 * Short blocks come first and lack the last data codeword the long ones carry.
 */
export function interleave(data: Uint8Array, version: number, level: QrLevel): Uint8Array {
	let blockCount = errorCorrectionBlocks(version, level);
	let eccLength = eccCodewordsPerBlock(version, level);
	let rawCodewords = Math.floor(rawDataModules(version) / 8);
	let shortBlocks = blockCount - (rawCodewords % blockCount);
	let shortDataLength = Math.floor(rawCodewords / blockCount) - eccLength;
	let divisor = reedSolomonDivisor(eccLength);

	let dataBlocks: Uint8Array[] = [];
	let eccBlocks: Uint8Array[] = [];
	for (let block = 0, offset = 0; block < blockCount; block++) {
		let length = shortDataLength + (block < shortBlocks ? 0 : 1);
		let blockData = data.subarray(offset, offset + length);
		offset += length;
		dataBlocks.push(blockData);
		eccBlocks.push(reedSolomonRemainder(blockData, divisor));
	}

	let result = new Uint8Array(rawCodewords);
	let position = 0;
	for (let index = 0; index <= shortDataLength; index++) {
		for (let blockData of dataBlocks) {
			if (index < blockData.length) result[position++] = blockData[index] ?? 0;
		}
	}
	for (let index = 0; index < eccLength; index++) {
		for (let ecc of eccBlocks) result[position++] = ecc[index] ?? 0;
	}
	return result;
}

/** The mask with the lowest penalty, scored with its format bits drawn; ties go to the lower number. */
function bestMask(matrix: Matrix, level: QrLevel): number {
	let best = 0;
	let lowest = Infinity;
	for (let candidate = 0; candidate < 8; candidate++) {
		applyMask(matrix, candidate);
		drawFormatBits(matrix, level, candidate);
		let penalty = penaltyScore(matrix);
		if (penalty < lowest) {
			best = candidate;
			lowest = penalty;
		}
		applyMask(matrix, candidate);
	}
	return best;
}

/** An integer version within 1–40. */
function isVersion(value: number): boolean {
	return Number.isInteger(value) && value >= 1 && value <= 40;
}
