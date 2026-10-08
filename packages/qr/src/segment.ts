/**
 * Splits text into numeric, alphanumeric and byte segments with the fewest total bits, by
 * a linear dynamic programme over the characters. The cost depends on the character count
 * widths, which change at versions 10 and 27, so segments are computed for one version.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** An encoding mode the encoder emits; Kanji is outside the package's scope. */
export type QrMode = "numeric" | "alphanumeric" | "byte";

/** A run of input in one mode, with its data bits already packed. */
export interface Segment {
	mode: QrMode;
	/** Characters for numeric and alphanumeric, bytes for byte mode: what the count field holds. */
	count: number;
	bits: number[];
}

/** The four-bit indicator that opens each segment. */
const MODE_INDICATOR: Readonly<Record<QrMode, number>> = {
	numeric: 0x1,
	alphanumeric: 0x2,
	byte: 0x4,
};

/** Character count field widths for versions 1–9, 10–26 and 27–40. */
const CHAR_COUNT_BITS: Readonly<Record<QrMode, readonly [number, number, number]>> = {
	numeric: [10, 12, 14],
	alphanumeric: [9, 11, 13],
	byte: [8, 16, 16],
};

/** The 45 characters alphanumeric mode encodes, in value order. */
const ALPHANUMERIC_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

/** Modes in the order the dynamic programme indexes its cost arrays. */
const MODES: readonly QrMode[] = ["byte", "alphanumeric", "numeric"];

/** Append `length` bits of `value`, most significant first. */
export function appendBits(bits: number[], value: number, length: number): void {
	for (let index = length - 1; index >= 0; index--) bits.push((value >>> index) & 1);
}

/** The width of a segment's count field at `version`. */
export function charCountBits(mode: QrMode, version: number): number {
	let [small, medium, large] = CHAR_COUNT_BITS[mode];
	return version < 10 ? small : version < 27 ? medium : large;
}

/** Bits the segments take at `version`, headers included. */
export function totalBits(segments: readonly Segment[], version: number): number {
	let total = 0;
	for (let segment of segments)
		total += 4 + charCountBits(segment.mode, version) + segment.bits.length;
	return total;
}

/** Write every segment's header and data into one bit stream for `version`. */
export function writeSegments(segments: readonly Segment[], version: number): number[] {
	let bits: number[] = [];
	for (let segment of segments) {
		appendBits(bits, MODE_INDICATOR[segment.mode], 4);
		appendBits(bits, segment.count, charCountBits(segment.mode, version));
		for (let bit of segment.bits) bits.push(bit);
	}
	return bits;
}

/** Bytes as byte-mode segments, split where a run outgrows the count field at `version`. */
export function bytesSegments(bytes: Uint8Array, version: number): Segment[] {
	let limit = 2 ** charCountBits("byte", version) - 1;
	let segments: Segment[] = [];
	for (let start = 0; start < bytes.length; start += limit) {
		let chunk = bytes.subarray(start, start + limit);
		let bits: number[] = [];
		for (let byte of chunk) appendBits(bits, byte, 8);
		segments.push({ mode: "byte", count: chunk.length, bits });
	}
	return segments;
}

/**
 * The segmentation of `text` with the fewest bits at `version`. Costs run in sixths of a
 * bit so 10 bits per three digits and 11 per two alphanumerics stay integers; a run longer
 * than its count field allows is split into several segments of the same mode.
 */
export function textSegments(text: string, version: number): Segment[] {
	let characters = Array.from(text);
	if (characters.length === 0) return [];

	let modes = optimalModes(characters, version);
	let segments: Segment[] = [];
	let start = 0;
	for (let index = 1; index <= characters.length; index++) {
		if (index < characters.length && modes[index] === modes[start]) continue;
		let run = characters.slice(start, index).join("");
		let mode = modes[start] ?? "byte";
		if (mode === "byte") segments.push(...bytesSegments(new TextEncoder().encode(run), version));
		else segments.push(...characterSegments(mode, run, version));
		start = index;
	}
	return segments;
}

/**
 * The mode each character is encoded in. Forward pass: for every character and every
 * mode, the cheapest cost of the prefix ending in that mode and the mode the previous
 * character took. Backward pass: walk those choices from the cheapest final mode.
 */
function optimalModes(characters: readonly string[], version: number): QrMode[] {
	let headCosts = MODES.map((mode) => (4 + charCountBits(mode, version)) * 6);
	let previousCosts = headCosts.slice();
	let choices: (QrMode | undefined)[][] = [];

	for (let character of characters) {
		let costs = [Infinity, Infinity, Infinity];
		let from: (QrMode | undefined)[] = [undefined, undefined, undefined];

		costs[0] = (previousCosts[0] ?? Infinity) + utf8Length(character) * 8 * 6;
		from[0] = "byte";
		if (ALPHANUMERIC_CHARSET.includes(character)) {
			costs[1] = (previousCosts[1] ?? Infinity) + 33;
			from[1] = "alphanumeric";
		}
		if (character >= "0" && character <= "9") {
			costs[2] = (previousCosts[2] ?? Infinity) + 20;
			from[2] = "numeric";
		}

		let extended = costs.slice();
		for (let to = 0; to < MODES.length; to++) {
			for (let source = 0; source < MODES.length; source++) {
				let extendedCost = extended[source] ?? Infinity;
				if (extendedCost === Infinity) continue;
				let switched = Math.ceil(extendedCost / 6) * 6 + (headCosts[to] ?? Infinity);
				if (switched < (costs[to] ?? Infinity)) {
					costs[to] = switched;
					from[to] = MODES[source];
				}
			}
		}

		choices.push(from);
		previousCosts = costs;
	}

	let mode: QrMode | undefined;
	let cheapest = Infinity;
	for (let index = 0; index < MODES.length; index++) {
		if ((previousCosts[index] ?? Infinity) < cheapest) {
			cheapest = previousCosts[index] ?? Infinity;
			mode = MODES[index];
		}
	}

	let result: QrMode[] = [];
	for (let index = characters.length - 1; index >= 0; index--) {
		mode = choices[index]?.[MODES.indexOf(mode ?? "byte")] ?? "byte";
		result.push(mode);
	}
	return result.reverse();
}

/**
 * Numeric or alphanumeric segments for `run`: three digits in 10 bits (a trailing two in
 * 7, one in 4), or two characters in 11 bits (a trailing one in 6).
 */
function characterSegments(
	mode: "numeric" | "alphanumeric",
	run: string,
	version: number,
): Segment[] {
	let limit = 2 ** charCountBits(mode, version) - 1;
	let segments: Segment[] = [];
	for (let start = 0; start < run.length; start += limit) {
		let chunk = run.slice(start, start + limit);
		let bits: number[] = [];
		if (mode === "numeric") {
			for (let index = 0; index < chunk.length; index += 3) {
				let digits = chunk.slice(index, index + 3);
				appendBits(bits, Number(digits), digits.length * 3 + 1);
			}
		} else {
			for (let index = 0; index < chunk.length; index += 2) {
				let first = ALPHANUMERIC_CHARSET.indexOf(chunk.charAt(index));
				if (index + 1 < chunk.length) {
					appendBits(bits, first * 45 + ALPHANUMERIC_CHARSET.indexOf(chunk.charAt(index + 1)), 11);
				} else {
					appendBits(bits, first, 6);
				}
			}
		}
		segments.push({ mode, count: chunk.length, bits });
	}
	return segments;
}

/** Bytes `character` takes in UTF-8; a lone surrogate takes the three of U+FFFD, as `TextEncoder` writes it. */
function utf8Length(character: string): number {
	let codePoint = character.codePointAt(0) ?? 0;
	if (codePoint < 0x80) return 1;
	if (codePoint < 0x800) return 2;
	if (codePoint < 0x10000) return 3;
	return 4;
}
