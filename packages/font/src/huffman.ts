/**
 * Bit-level reading and canonical prefix-code decoding shared by the zlib and Brotli
 * decoders. Both formats pack bits least-significant first and store canonical codes, so one
 * two-level lookup table serves either, and every read past the input answers zeros.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Bits the first level of a lookup table resolves; longer codes go through a second level. */
const ROOT_BITS = 8;

/** The longest code either format allows. */
const MAX_CODE_LENGTH = 15;

/** Marks a first-level entry that points at a second-level table. */
const SUBTABLE_FLAG = 1 << 24;

/** A table entry no code reaches; decoding it fails. */
const INVALID_ENTRY = -1;

/**
 * Reads a byte array as a stream of bits, least significant bit of each byte first. Reads
 * past the end answer zeros and leave `exhausted` set, so a decoder checks once per loop
 * instead of guarding every read.
 */
export class BitReader {
	#bytes: Uint8Array;
	#position = 0;

	/**
	 * @param bytes - The compressed stream.
	 */
	constructor(bytes: Uint8Array) {
		this.#bytes = bytes;
	}

	/** Whether a read went past the last byte of the stream. */
	get exhausted(): boolean {
		return this.#position > this.#bytes.length * 8;
	}

	/** The bit position, `0` at the start of the stream. */
	get position(): number {
		return this.#position;
	}

	/** At least 25 upcoming bits, the next one in bit 0, without consuming them. */
	peek(): number {
		let bytes = this.#bytes;
		let index = this.#position >>> 3;
		let word =
			(bytes[index] ?? 0) |
			((bytes[index + 1] ?? 0) << 8) |
			((bytes[index + 2] ?? 0) << 16) |
			((bytes[index + 3] ?? 0) << 24);
		return word >>> (this.#position & 7);
	}

	/**
	 * Consumes `count` bits and answers them as an unsigned number.
	 *
	 * @param count - 0 to 24 bits.
	 */
	read(count: number): number {
		if (count === 0) return 0;
		let value = this.peek() & ((1 << count) - 1);
		this.#position += count;
		return value;
	}

	/**
	 * Consumes `count` bits without reading them.
	 *
	 * @param count - How many bits.
	 */
	skip(count: number): void {
		this.#position += count;
	}

	/**
	 * Moves to the next byte boundary and answers whether the skipped padding bits were all
	 * zero, which both formats require of a well-formed stream.
	 */
	align(): boolean {
		let padding = (8 - (this.#position & 7)) & 7;
		return this.read(padding) === 0;
	}

	/**
	 * Consumes `count` whole bytes from a byte boundary, as a view of the input.
	 *
	 * @param count - How many bytes; fewer come back when the input ends first.
	 */
	bytes(count: number): Uint8Array {
		let start = Math.min(this.#position >>> 3, this.#bytes.length);
		this.#position = (start + count) * 8;
		return this.#bytes.subarray(start, Math.min(start + count, this.#bytes.length));
	}
}

/**
 * Builds the decoding table of a canonical prefix code from each symbol's code length; a
 * code that leaves some bit patterns unassigned decodes them as invalid.
 *
 * @param lengths - The code length of each symbol, `0` for an unused one, at most 15.
 * @param count - How many entries of `lengths` belong to the alphabet.
 * @returns The table for `decodeSymbol`, or `null` when the lengths over-subscribe the code.
 */
export function huffmanTable(lengths: ArrayLike<number>, count: number): Int32Array | null {
	let perLength = new Int32Array(MAX_CODE_LENGTH + 1);
	for (let symbol = 0; symbol < count; symbol++) {
		let length = lengths[symbol] ?? 0;
		if (length > MAX_CODE_LENGTH) return null;
		perLength[length] = (perLength[length] ?? 0) + 1;
	}
	let left = 1;
	let next = new Int32Array(MAX_CODE_LENGTH + 2);
	for (let length = 1; length <= MAX_CODE_LENGTH; length++) {
		left = left * 2 - (perLength[length] ?? 0);
		if (left < 0) return null;
		next[length + 1] = ((next[length] ?? 0) + (perLength[length] ?? 0)) * 2;
	}

	let codes = new Int32Array(count);
	let subBits = new Int32Array(1 << ROOT_BITS);
	for (let symbol = 0; symbol < count; symbol++) {
		let length = lengths[symbol] ?? 0;
		if (length === 0) continue;
		let code = reverseBits(next[length] ?? 0, length);
		next[length] = (next[length] ?? 0) + 1;
		codes[symbol] = code;
		if (length > ROOT_BITS) {
			let root = code & ((1 << ROOT_BITS) - 1);
			subBits[root] = Math.max(subBits[root] ?? 0, length - ROOT_BITS);
		}
	}

	let size = 1 << ROOT_BITS;
	let offsets = new Int32Array(1 << ROOT_BITS);
	for (let root = 0; root < 1 << ROOT_BITS; root++) {
		let bits = subBits[root] ?? 0;
		if (bits === 0) continue;
		offsets[root] = size;
		size += 1 << bits;
	}
	let table = new Int32Array(size).fill(INVALID_ENTRY);
	for (let root = 0; root < 1 << ROOT_BITS; root++) {
		let bits = subBits[root] ?? 0;
		if (bits > 0) table[root] = SUBTABLE_FLAG | (bits << 16) | (offsets[root] ?? 0);
	}
	for (let symbol = 0; symbol < count; symbol++) {
		let length = lengths[symbol] ?? 0;
		if (length === 0) continue;
		let code = codes[symbol] ?? 0;
		let entry = (length << 16) | symbol;
		if (length <= ROOT_BITS) {
			for (let index = code; index < 1 << ROOT_BITS; index += 1 << length) table[index] = entry;
			continue;
		}
		let root = code & ((1 << ROOT_BITS) - 1);
		let base = offsets[root] ?? 0;
		let span = 1 << (subBits[root] ?? 0);
		for (let index = code >>> ROOT_BITS; index < span; index += 1 << (length - ROOT_BITS)) {
			table[base + index] = entry;
		}
	}
	return table;
}

/**
 * The table of a code with one symbol, which costs no bits to decode.
 *
 * @param symbol - The only symbol.
 */
export function singleSymbolTable(symbol: number): Int32Array {
	return new Int32Array(1 << ROOT_BITS).fill(symbol);
}

/**
 * Decodes one symbol.
 *
 * @param reader - Positioned at the symbol's code.
 * @param table - From `huffmanTable` or `singleSymbolTable`.
 * @returns The symbol, or `-1` for a bit pattern the code does not assign.
 */
export function decodeSymbol(reader: BitReader, table: Int32Array): number {
	let bits = reader.peek();
	let entry = table[bits & ((1 << ROOT_BITS) - 1)] ?? INVALID_ENTRY;
	if (entry >= SUBTABLE_FLAG) {
		let mask = (1 << ((entry >>> 16) & 0xff)) - 1;
		entry = table[(entry & 0xffff) + ((bits >>> ROOT_BITS) & mask)] ?? INVALID_ENTRY;
	}
	if (entry < 0) return -1;
	reader.skip(entry >>> 16);
	return entry & 0xffff;
}

/**
 * Reverses the low `length` bits of `code`: canonical codes are defined most significant bit
 * first, while both formats emit them least significant bit first.
 *
 * @param code - The canonical code.
 * @param length - Its length in bits.
 */
function reverseBits(code: number, length: number): number {
	let reversed = 0;
	for (let bit = 0; bit < length; bit++) {
		reversed = (reversed << 1) | ((code >>> bit) & 1);
	}
	return reversed;
}
