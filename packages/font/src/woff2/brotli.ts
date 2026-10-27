/**
 * A Brotli (RFC 7932) decoder in plain TypeScript, the compression WOFF2 wraps its tables
 * in. It decodes a whole stream into one buffer, so every back reference reads from memory
 * already written, and fails on corrupt input instead of throwing or looping.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import { FontError } from "../font-error.js";
import { BitReader, decodeSymbol, huffmanTable, singleSymbolTable } from "../huffman.js";
import { copyMatch } from "../inflate.js";

import { BROTLI_DICTIONARY_BASE64 } from "./dictionary.data.js";

/** The largest output a stream of unknown size may grow to before it counts as hostile. */
const MAX_OUTPUT = 2 ** 30;

/** How many dictionary words that transform to nothing a stream may hold before it is rejected. */
const MAX_EMPTY_WORDS = 1 << 16;

/** `NDBITS` of the static dictionary: log2 of how many words it holds of each length. */
const DICTIONARY_BITS = [
	0, 0, 0, 0, 10, 10, 11, 11, 10, 10, 10, 10, 10, 9, 9, 8, 7, 7, 8, 7, 7, 6, 6, 5, 5,
];

/**
 * The 121 word transforms of RFC 7932 Appendix B: prefix, elementary transform, suffix. The
 * transform is 0 for Identity, 1 FermentFirst, 2 FermentAll, 3–11 OmitFirst1–9 and 12–20
 * OmitLast1–9; the strings hold bytes, one per character.
 */
export const BROTLI_TRANSFORMS: readonly (readonly [string, number, string])[] = [
	["", 0, ""],
	["", 0, " "],
	[" ", 0, " "],
	["", 3, ""],
	["", 1, " "],
	["", 0, " the "],
	[" ", 0, ""],
	["s ", 0, " "],
	["", 0, " of "],
	["", 1, ""],
	["", 0, " and "],
	["", 4, ""],
	["", 12, ""],
	[", ", 0, " "],
	["", 0, ", "],
	[" ", 1, " "],
	["", 0, " in "],
	["", 0, " to "],
	["e ", 0, " "],
	["", 0, '"'],
	["", 0, "."],
	["", 0, '">'],
	["", 0, "\n"],
	["", 14, ""],
	["", 0, "]"],
	["", 0, " for "],
	["", 5, ""],
	["", 13, ""],
	["", 0, " a "],
	["", 0, " that "],
	[" ", 1, ""],
	["", 0, ". "],
	[".", 0, ""],
	[" ", 0, ", "],
	["", 6, ""],
	["", 0, " with "],
	["", 0, "'"],
	["", 0, " from "],
	["", 0, " by "],
	["", 7, ""],
	["", 8, ""],
	[" the ", 0, ""],
	["", 15, ""],
	["", 0, ". The "],
	["", 2, ""],
	["", 0, " on "],
	["", 0, " as "],
	["", 0, " is "],
	["", 18, ""],
	["", 12, "ing "],
	["", 0, "\n\t"],
	["", 0, ":"],
	[" ", 0, ". "],
	["", 0, "ed "],
	["", 11, ""],
	["", 9, ""],
	["", 17, ""],
	["", 0, "("],
	["", 1, ", "],
	["", 19, ""],
	["", 0, " at "],
	["", 0, "ly "],
	[" the ", 0, " of "],
	["", 16, ""],
	["", 20, ""],
	[" ", 1, ", "],
	["", 1, '"'],
	[".", 0, "("],
	["", 2, " "],
	["", 1, '">'],
	["", 0, '="'],
	[" ", 0, "."],
	[".com/", 0, ""],
	[" the ", 0, " of the "],
	["", 1, "'"],
	["", 0, ". This "],
	["", 0, ","],
	[".", 0, " "],
	["", 1, "("],
	["", 1, "."],
	["", 0, " not "],
	[" ", 0, '="'],
	["", 0, "er "],
	[" ", 2, " "],
	["", 0, "al "],
	[" ", 2, ""],
	["", 0, "='"],
	["", 2, '"'],
	["", 1, ". "],
	[" ", 0, "("],
	["", 0, "ful "],
	[" ", 1, ". "],
	["", 0, "ive "],
	["", 0, "less "],
	["", 2, "'"],
	["", 0, "est "],
	[" ", 1, "."],
	["", 2, '">'],
	[" ", 0, "='"],
	["", 1, ","],
	["", 0, "ize "],
	["", 2, "."],
	["\xc2\xa0", 0, ""],
	[" ", 0, ","],
	["", 1, '="'],
	["", 2, '="'],
	["", 0, "ous "],
	["", 2, ", "],
	["", 1, "='"],
	[" ", 1, ","],
	[" ", 2, '="'],
	[" ", 2, ", "],
	["", 2, ","],
	["", 2, "("],
	["", 2, ". "],
	[" ", 2, "."],
	["", 2, "='"],
	[" ", 2, ". "],
	[" ", 1, '="'],
	[" ", 2, "='"],
	[" ", 1, "='"],
];

/** Insert length base of each insert length code 0–23. */
const INSERT_BASE = [
	0, 1, 2, 3, 4, 5, 6, 8, 10, 14, 18, 26, 34, 50, 66, 98, 130, 194, 322, 578, 1090, 2114, 6210,
	22594,
];

/** Extra bits of each insert length code. */
const INSERT_EXTRA = [0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 7, 8, 9, 10, 12, 14, 24];

/** Copy length base of each copy length code 0–23. */
const COPY_BASE = [
	2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 18, 22, 30, 38, 54, 70, 102, 134, 198, 326, 582, 1094, 2118,
];

/** Extra bits of each copy length code. */
const COPY_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 7, 8, 9, 10, 24];

/** First insert length code of each 64-symbol cell of the insert-and-copy alphabet. */
const CELL_INSERT = [0, 0, 0, 0, 8, 8, 0, 16, 8, 16, 16];

/** First copy length code of each 64-symbol cell of the insert-and-copy alphabet. */
const CELL_COPY = [0, 8, 0, 8, 0, 8, 16, 0, 16, 8, 16];

/** Block count base of each block count code 0–25. */
const BLOCK_BASE = [
	1, 5, 9, 13, 17, 25, 33, 41, 49, 65, 81, 97, 113, 145, 177, 209, 241, 305, 369, 497, 753, 1265,
	2289, 4337, 8433, 16625,
];

/** Extra bits of each block count code. */
const BLOCK_EXTRA = [
	2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 7, 8, 9, 10, 11, 12, 13, 24,
];

/** Which recent distance each of the 16 short distance codes starts from, 0 the last. */
const SHORT_INDEX = [0, 1, 2, 3, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1];

/** What each short distance code adds to the recent distance it starts from. */
const SHORT_DELTA = [0, 0, 0, 0, -1, 1, -2, 2, -3, 3, -1, 1, -2, 2, -3, 3];

/** The order a complex prefix code lists its code-length code lengths in. */
const CODE_LENGTH_ORDER = [1, 2, 3, 4, 0, 5, 17, 6, 16, 7, 8, 9, 10, 11, 12, 13, 14, 15];

/** `Lut0` of RFC 7932 §7.1, the UTF8 context of the last byte. */
export const CONTEXT_LUT0 = utf8LastByteContext();

/** `Lut1` of RFC 7932 §7.1, the UTF8 context of the byte before the last. */
export const CONTEXT_LUT1 = utf8SecondByteContext();

/** `Lut2` of RFC 7932 §7.1, the Signed context of either byte. */
export const CONTEXT_LUT2 = signedContext();

/** The decoded static dictionary and each word length's offset in it, built on first use. */
const DICTIONARY: { bytes: Uint8Array | null; offsets: number[] } = { bytes: null, offsets: [] };

/** One block category (literals, insert-and-copy commands or distances) of a meta-block. */
interface BlockCategory {
	/** How many block types the category has. */
	types: number;
	/** The block type code, `null` with a single type. */
	typeCode: Int32Array | null;
	/** The block count code, `null` with a single type. */
	countCode: Int32Array | null;
	type: number;
	previous: number;
	/** Symbols left in the current block. */
	remaining: number;
}

/** The header of a compressed meta-block, which its commands decode against. */
interface MetaBlock {
	literal: BlockCategory;
	command: BlockCategory;
	distance: BlockCategory;
	modes: Uint8Array;
	literalMap: Uint8Array;
	distanceMap: Uint8Array;
	literalCodes: Int32Array[];
	commandCodes: Int32Array[];
	distanceCodes: Int32Array[];
	postfix: number;
	direct: number;
}

/** A table that decodes nothing, for an index a corrupt stream points past. */
const EMPTY = new Int32Array(256).fill(-1);

/**
 * Decompresses a Brotli stream.
 *
 * @param input - The compressed bytes.
 * @param size - The exact decompressed size when the container records it, which sizes the
 *   output once and turns any other length into a failure.
 * @returns The decompressed bytes, or a `malformed` `FontError` explaining the corruption.
 */
export function decompressBrotli(input: Uint8Array, size?: number): Result<Uint8Array, FontError> {
	let decoder = new BrotliDecoder(input, size);
	let output = decoder.decode();
	if (output === null) {
		return failure(new FontError("malformed", `The Brotli stream is corrupt: ${decoder.error}.`));
	}
	return success(output);
}

/** The state of one stream's decoding; `error` says why `decode` answered `null`. */
class BrotliDecoder {
	error = "";
	#reader: BitReader;
	#output: Uint8Array;
	#fixed: boolean;
	#position = 0;
	#window = 0;
	#distances = [4, 11, 15, 16];
	#emptyWords = 0;

	/**
	 * @param input - The compressed bytes.
	 * @param size - The exact output size, when known.
	 */
	constructor(input: Uint8Array, size: number | undefined) {
		this.#reader = new BitReader(input);
		this.#fixed = size !== undefined;
		this.#output = new Uint8Array(size ?? Math.min(Math.max(input.length * 4, 1024), MAX_OUTPUT));
	}

	/** Decodes every meta-block, answering the output or `null` with `error` set. */
	decode(): Uint8Array | null {
		let reader = this.#reader;
		let bits = this.#windowBits();
		if (bits === 0) return this.#fail("the window size is invalid", null);
		this.#window = (1 << bits) - 16;
		for (;;) {
			if (reader.exhausted) return this.#fail("the stream ends early", null);
			let last = reader.read(1);
			if (last === 1 && reader.read(1) === 1) break;
			let length = this.#metaBlockLength();
			if (length < 0) return null;
			if (length > 0) {
				let uncompressed = last === 0 ? reader.read(1) : 0;
				if (!this.#reserve(length)) return null;
				let decoded = uncompressed === 1 ? this.#uncompressed(length) : this.#compressed(length);
				if (!decoded) return null;
			}
			if (last === 1) break;
		}
		if (reader.exhausted) return this.#fail("the stream ends early", null);
		if (this.#fixed && this.#position !== this.#output.length) {
			return this.#fail("the stream decodes to fewer bytes than expected", null);
		}
		return this.#output.subarray(0, this.#position);
	}

	/**
	 * Records why decoding stopped.
	 *
	 * @param message - The reason, completing "The Brotli stream is corrupt: …".
	 * @param value - What the failing step answers.
	 */
	#fail<T>(message: string, value: T): T {
		this.error = message;
		return value;
	}

	/** `WBITS` from the stream header, `0` for an invalid code. */
	#windowBits(): number {
		let reader = this.#reader;
		if (reader.read(1) === 0) return 16;
		let large = reader.read(3);
		if (large !== 0) return 17 + large;
		let small = reader.read(3);
		if (small === 1) return 0;
		return small === 0 ? 17 : 8 + small;
	}

	/**
	 * Reads `MNIBBLES` and `MLEN`, skipping a metadata block entirely.
	 *
	 * @returns The meta-block's uncompressed length, `0` for metadata, `-1` when corrupt.
	 */
	#metaBlockLength(): number {
		let reader = this.#reader;
		let nibbles = reader.read(2) + 4;
		if (nibbles === 7) {
			if (reader.read(1) !== 0) return this.#fail("a reserved bit is set", -1);
			let bytes = reader.read(2);
			let skip = 0;
			for (let index = 0; index < bytes; index++) {
				let byte = reader.read(8);
				if (index === bytes - 1 && bytes > 1 && byte === 0) {
					return this.#fail("a metadata length has a leading zero byte", -1);
				}
				skip |= byte << (index * 8);
			}
			if (bytes > 0) skip += 1;
			if (!reader.align()) return this.#fail("padding bits are set", -1);
			if (reader.bytes(skip).length < skip) return this.#fail("the stream ends early", -1);
			return 0;
		}
		let length = 0;
		for (let index = 0; index < nibbles; index++) {
			let nibble = reader.read(4);
			if (index === nibbles - 1 && nibbles > 4 && nibble === 0) {
				return this.#fail("a meta-block length has a leading zero nibble", -1);
			}
			length |= nibble << (index * 4);
		}
		return length + 1;
	}

	/**
	 * Makes room for `length` more output bytes.
	 *
	 * @param length - The next meta-block's length.
	 */
	#reserve(length: number): boolean {
		let needed = this.#position + length;
		if (needed <= this.#output.length) return true;
		if (this.#fixed) return this.#fail("the stream decodes to more bytes than expected", false);
		if (needed > MAX_OUTPUT) return this.#fail("the output exceeds 1 GiB", false);
		let grown = new Uint8Array(Math.min(Math.max(needed, this.#output.length * 2), MAX_OUTPUT));
		grown.set(this.#output.subarray(0, this.#position));
		this.#output = grown;
		return true;
	}

	/**
	 * Copies an uncompressed meta-block.
	 *
	 * @param length - Its byte count.
	 */
	#uncompressed(length: number): boolean {
		let reader = this.#reader;
		if (!reader.align()) return this.#fail("padding bits are set", false);
		let bytes = reader.bytes(length);
		if (bytes.length < length) return this.#fail("the stream ends early", false);
		this.#output.set(bytes, this.#position);
		this.#position += length;
		return true;
	}

	/**
	 * Decodes a compressed meta-block: its header of block types, context maps and prefix
	 * codes, then commands until `length` bytes are out.
	 *
	 * @param length - The meta-block's uncompressed length.
	 */
	#compressed(length: number): boolean {
		let reader = this.#reader;
		let literal = this.#category();
		let command = literal === null ? null : this.#category();
		let distance = command === null ? null : this.#category();
		if (literal === null || command === null || distance === null) return false;
		let postfix = reader.read(2);
		let direct = reader.read(4) << postfix;
		let modes = new Uint8Array(literal.types);
		for (let index = 0; index < literal.types; index++) modes[index] = reader.read(2);
		let literalTrees = this.#count();
		let literalMap = this.#contextMap(literal.types * 64, literalTrees);
		let distanceTrees = literalMap === null ? 0 : this.#count();
		let distanceMap =
			literalMap === null ? null : this.#contextMap(distance.types * 4, distanceTrees);
		if (literalMap === null || distanceMap === null) return false;
		let literalCodes = this.#codes(literalTrees, 256);
		let commandCodes = literalCodes === null ? null : this.#codes(command.types, 704);
		let distanceCodes =
			commandCodes === null ? null : this.#codes(distanceTrees, 16 + direct + (48 << postfix));
		if (literalCodes === null || commandCodes === null || distanceCodes === null) return false;
		return this.#commands(length, {
			literal,
			command,
			distance,
			modes,
			literalMap,
			distanceMap,
			literalCodes,
			commandCodes,
			distanceCodes,
			postfix,
			direct,
		});
	}

	/**
	 * Runs a meta-block's commands: literals, then a back reference or dictionary word.
	 *
	 * @param length - The meta-block's uncompressed length.
	 * @param block - Its header.
	 */
	#commands(length: number, block: MetaBlock): boolean {
		let reader = this.#reader;
		let output = this.#output;
		let remaining = length;
		while (remaining > 0) {
			if (reader.exhausted) return this.#fail("the stream ends early", false);
			if (!this.#nextBlock(block.command)) return false;
			let symbol = decodeSymbol(reader, block.commandCodes[block.command.type] ?? EMPTY);
			if (symbol < 0) return this.#fail("an insert-and-copy code is invalid", false);
			let cell = symbol >>> 6;
			let insertCode = (CELL_INSERT[cell] ?? 0) + ((symbol >>> 3) & 7);
			let copyCode = (CELL_COPY[cell] ?? 0) + (symbol & 7);
			let insert = (INSERT_BASE[insertCode] ?? 0) + reader.read(INSERT_EXTRA[insertCode] ?? 0);
			let copy = (COPY_BASE[copyCode] ?? 0) + reader.read(COPY_EXTRA[copyCode] ?? 0);
			if (insert > remaining) return this.#fail("literals overrun the meta-block", false);
			if (!this.#literals(insert, block)) return false;
			remaining -= insert;
			if (remaining === 0) break;

			let code = 0;
			let distance = this.#distances[0] ?? 0;
			if (symbol >= 128) {
				if (!this.#nextBlock(block.distance)) return false;
				let context = copy > 4 ? 3 : copy - 2;
				let tree = block.distanceMap[block.distance.type * 4 + context] ?? 0;
				code = decodeSymbol(reader, block.distanceCodes[tree] ?? EMPTY);
				distance = this.#distance(code, block.postfix, block.direct);
				if (distance <= 0) return this.#fail("a distance is invalid", false);
			}
			let reach = Math.min(this.#window, this.#position);
			if (distance > reach) {
				let written = this.#word(copy, distance - reach - 1, remaining);
				if (written < 0) return false;
				remaining -= written;
				continue;
			}
			if (copy > remaining) return this.#fail("a copy overruns the meta-block", false);
			if (code !== 0) this.#distances = [distance, ...this.#distances.slice(0, 3)];
			copyMatch(output, this.#position, distance, copy);
			this.#position += copy;
			remaining -= copy;
		}
		return true;
	}

	/**
	 * Decodes `count` literals, each through the prefix code its block type and the context
	 * of the two bytes before it select.
	 *
	 * @param count - How many literals.
	 * @param block - The meta-block header.
	 */
	#literals(count: number, block: MetaBlock): boolean {
		let reader = this.#reader;
		let output = this.#output;
		let position = this.#position;
		let p1 = output[position - 1] ?? 0;
		let p2 = output[position - 2] ?? 0;
		for (let index = 0; index < count; index++) {
			if (!this.#nextBlock(block.literal)) return false;
			let mode = block.modes[block.literal.type] ?? 0;
			let context = literalContext(mode, p1, p2);
			let tree = block.literalMap[block.literal.type * 64 + context] ?? 0;
			let byte = decodeSymbol(reader, block.literalCodes[tree] ?? EMPTY);
			if (byte < 0) return this.#fail("a literal code is invalid", false);
			output[position++] = byte;
			p2 = p1;
			p1 = byte;
		}
		this.#position = position;
		return true;
	}

	/**
	 * Resolves a distance code against the recent distances, `NPOSTFIX` and `NDIRECT`.
	 *
	 * @param code - The distance symbol, `-1` when it failed to decode.
	 * @param postfix - `NPOSTFIX`.
	 * @param direct - `NDIRECT`.
	 * @returns The backward distance, `0` or less when invalid.
	 */
	#distance(code: number, postfix: number, direct: number): number {
		if (code < 0) return 0;
		if (code < 16) {
			return (this.#distances[SHORT_INDEX[code] ?? 0] ?? 0) + (SHORT_DELTA[code] ?? 0);
		}
		if (code < 16 + direct) return code - 15;
		let rest = code - direct - 16;
		let extraBits = 1 + (rest >>> (postfix + 1));
		let high = rest >>> postfix;
		let low = rest & ((1 << postfix) - 1);
		let offset = (2 + (high & 1)) * 2 ** extraBits - 4;
		return (offset + this.#reader.read(extraBits)) * (1 << postfix) + low + direct + 1;
	}

	/**
	 * Writes a static dictionary word, transformed.
	 *
	 * @param length - The base word's length, 4 to 24.
	 * @param id - The word id: index and transform.
	 * @param remaining - Bytes left in the meta-block.
	 * @returns How many bytes it wrote, `-1` when the reference is invalid.
	 */
	#word(length: number, id: number, remaining: number): number {
		let bits = DICTIONARY_BITS[length] ?? 0;
		if (length < 4 || length > 24 || bits === 0) {
			return this.#fail("a dictionary word length is invalid", -1);
		}
		let transform = BROTLI_TRANSFORMS[Math.floor(id / 2 ** bits)];
		if (transform === undefined) return this.#fail("a dictionary transform is invalid", -1);
		let dictionary = staticDictionary();
		let start = (DICTIONARY.offsets[length] ?? 0) + (id & ((1 << bits) - 1)) * length;
		let word = transformWord(dictionary.subarray(start, start + length), transform);
		if (word.length > remaining) return this.#fail("a word overruns the meta-block", -1);
		if (word.length === 0 && ++this.#emptyWords > MAX_EMPTY_WORDS) {
			return this.#fail("too many empty dictionary words", -1);
		}
		this.#output.set(word, this.#position);
		this.#position += word.length;
		return word.length;
	}

	/**
	 * Starts the category's next block when the current one is used up, then counts one
	 * symbol against it.
	 *
	 * @param category - The block category.
	 */
	#nextBlock(category: BlockCategory): boolean {
		if (category.remaining === 0) {
			let symbol = decodeSymbol(this.#reader, category.typeCode ?? EMPTY);
			if (symbol < 0) return this.#fail("a block type code is invalid", false);
			let type = symbol - 2;
			if (symbol === 0) type = category.previous;
			else if (symbol === 1) type = (category.type + 1) % category.types;
			category.previous = category.type;
			category.type = type;
			let count = this.#blockCount(category.countCode ?? EMPTY);
			if (count < 0) return false;
			category.remaining = count;
		}
		category.remaining--;
		return true;
	}

	/**
	 * Reads a block count.
	 *
	 * @param code - The category's block count code.
	 * @returns The count, `-1` when the code is invalid.
	 */
	#blockCount(code: Int32Array): number {
		let symbol = decodeSymbol(this.#reader, code);
		if (symbol < 0) return this.#fail("a block count code is invalid", -1);
		return (BLOCK_BASE[symbol] ?? 0) + this.#reader.read(BLOCK_EXTRA[symbol] ?? 0);
	}

	/** Reads a block category's header: type count, codes and first block count. */
	#category(): BlockCategory | null {
		let types = this.#count();
		if (types < 2) {
			return {
				types: 1,
				typeCode: null,
				countCode: null,
				type: 0,
				previous: 1,
				remaining: Infinity,
			};
		}
		let typeCode = this.#prefixCode(types + 2);
		let countCode = typeCode === null ? null : this.#prefixCode(26);
		if (typeCode === null || countCode === null) return null;
		let remaining = this.#blockCount(countCode);
		if (remaining < 0) return null;
		return { types, typeCode, countCode, type: 0, previous: 1, remaining };
	}

	/** A count from 1 to 256 in the variable-length code of `NBLTYPES` and `NTREES`. */
	#count(): number {
		let reader = this.#reader;
		if (reader.read(1) === 0) return 1;
		let bits = reader.read(3);
		if (bits === 0) return 2;
		return reader.read(bits) + (1 << bits) + 1;
	}

	/**
	 * Reads `count` prefix codes over the same alphabet.
	 *
	 * @param count - How many.
	 * @param alphabet - The alphabet size.
	 */
	#codes(count: number, alphabet: number): Int32Array[] | null {
		let codes: Int32Array[] = [];
		for (let index = 0; index < count; index++) {
			let code = this.#prefixCode(alphabet);
			if (code === null) return null;
			codes.push(code);
		}
		return codes;
	}

	/**
	 * Reads a context map: run lengths of zeros, prefix-coded values, then an optional
	 * inverse move-to-front transform.
	 *
	 * @param size - How many entries.
	 * @param trees - `NTREES`, one more than the largest value.
	 */
	#contextMap(size: number, trees: number): Uint8Array | null {
		let map = new Uint8Array(size);
		if (trees < 2) return map;
		let reader = this.#reader;
		let runs = reader.read(1) === 1 ? reader.read(4) + 1 : 0;
		let code = this.#prefixCode(trees + runs);
		if (code === null) return null;
		let index = 0;
		while (index < size) {
			let symbol = decodeSymbol(reader, code);
			if (symbol < 0 || reader.exhausted) return this.#fail("a context map is corrupt", null);
			if (symbol === 0) {
				index++;
			} else if (symbol <= runs) {
				index += (1 << symbol) + reader.read(symbol);
				if (index > size) return this.#fail("a context map run overruns it", null);
			} else {
				map[index++] = symbol - runs;
			}
		}
		if (reader.read(1) === 1) inverseMoveToFront(map);
		return map;
	}

	/**
	 * Reads a simple or complex prefix code.
	 *
	 * @param alphabet - The alphabet size.
	 */
	#prefixCode(alphabet: number): Int32Array | null {
		let reader = this.#reader;
		let skip = reader.read(2);
		let table = skip === 1 ? this.#simpleCode(alphabet) : this.#complexCode(alphabet, skip);
		if (table === null && this.error === "") this.#fail("a prefix code is invalid", null);
		return table;
	}

	/**
	 * Reads a simple prefix code: up to four symbols with lengths implied by their count.
	 *
	 * @param alphabet - The alphabet size.
	 */
	#simpleCode(alphabet: number): Int32Array | null {
		let reader = this.#reader;
		let count = reader.read(2) + 1;
		let width = 32 - Math.clz32(alphabet - 1);
		let symbols: number[] = [];
		for (let index = 0; index < count; index++) {
			let symbol = reader.read(width);
			if (symbol >= alphabet || symbols.includes(symbol)) return null;
			symbols.push(symbol);
		}
		if (count === 1) return singleSymbolTable(symbols[0] ?? 0);
		let lengths = new Uint8Array(alphabet);
		for (let [index, length] of simpleCodeLengths(reader, count).entries()) {
			lengths[symbols[index] ?? 0] = length;
		}
		return huffmanTable(lengths, alphabet);
	}

	/**
	 * Reads a complex prefix code: code-length code lengths, then the code lengths.
	 *
	 * @param alphabet - The alphabet size.
	 * @param skip - `HSKIP`: how many leading code-length code lengths are zero.
	 */
	#complexCode(alphabet: number, skip: number): Int32Array | null {
		let reader = this.#reader;
		let codeLengths = new Uint8Array(18);
		let space = 32;
		let used = 0;
		let last = 0;
		for (let index = skip; index < 18 && space > 0; index++) {
			let length = codeLengthLength(reader);
			codeLengths[CODE_LENGTH_ORDER[index] ?? 0] = length;
			if (length !== 0) {
				space -= 32 >> length;
				used++;
				last = CODE_LENGTH_ORDER[index] ?? 0;
			}
		}
		if (used !== 1 && space !== 0) return null;
		let lengthCode = used === 1 ? singleSymbolTable(last) : huffmanTable(codeLengths, 18);
		if (lengthCode === null) return null;
		let lengths = readCodeLengths(reader, lengthCode, alphabet);
		if (lengths === null) return null;
		return huffmanTable(lengths, alphabet);
	}
}

/**
 * Reads the symbols' code lengths with the code-length code, expanding repeats of the
 * previous length (16) and of zero (17), until the code's space is filled.
 *
 * @param reader - Positioned at the first code length.
 * @param code - The code-length code.
 * @param alphabet - The alphabet size.
 * @returns The lengths, or `null` when they overrun the alphabet or leave the code incomplete.
 */
function readCodeLengths(reader: BitReader, code: Int32Array, alphabet: number): Uint8Array | null {
	let lengths = new Uint8Array(alphabet);
	let symbol = 0;
	let previous = 8;
	let repeat = 0;
	let repeatLength = 0;
	let space = 32768;
	while (symbol < alphabet && space > 0) {
		let length = decodeSymbol(reader, code);
		if (length < 0 || reader.exhausted) return null;
		if (length < 16) {
			repeat = 0;
			lengths[symbol++] = length;
			if (length !== 0) {
				previous = length;
				space -= 32768 >> length;
			}
			continue;
		}
		let extra = length === 16 ? 2 : 3;
		let value = length === 16 ? previous : 0;
		if (repeatLength !== value) {
			repeat = 0;
			repeatLength = value;
		}
		let before = repeat;
		if (repeat > 0) repeat = (repeat - 2) << extra;
		repeat += reader.read(extra) + 3;
		let added = repeat - before;
		if (symbol + added > alphabet) return null;
		lengths.fill(value, symbol, symbol + added);
		symbol += added;
		if (value !== 0) space -= added * (32768 >> value);
	}
	return space === 0 ? lengths : null;
}

/**
 * The code lengths of a simple prefix code's symbols, in the order they were listed; four
 * symbols read a tree-select bit choosing between two shapes.
 *
 * @param reader - Positioned after the symbols.
 * @param count - How many symbols, 2 to 4.
 */
function simpleCodeLengths(reader: BitReader, count: number): number[] {
	if (count === 2) return [1, 1];
	if (count === 3) return [1, 2, 2];
	return reader.read(1) === 1 ? [1, 2, 3, 3] : [2, 2, 2, 2];
}

/**
 * Reads one code-length code length with the fixed variable-length code of RFC 7932 §3.5.
 *
 * @param reader - Positioned at the length.
 */
function codeLengthLength(reader: BitReader): number {
	let bits = reader.peek() & 15;
	if ((bits & 3) === 0) return readBits(reader, 2, 0);
	if ((bits & 3) === 2) return readBits(reader, 2, 3);
	if ((bits & 3) === 1) return readBits(reader, 2, 4);
	if ((bits & 7) === 3) return readBits(reader, 3, 2);
	return bits === 7 ? readBits(reader, 4, 1) : readBits(reader, 4, 5);
}

/**
 * Consumes bits already inspected and answers the value they stand for.
 *
 * @param reader - The stream.
 * @param count - How many bits the value took.
 * @param value - What they decode to.
 */
function readBits(reader: BitReader, count: number, value: number): number {
	reader.skip(count);
	return value;
}

/**
 * The literal context ID for a context mode and the last two bytes.
 *
 * @param mode - 0 LSB6, 1 MSB6, 2 UTF8, 3 Signed.
 * @param p1 - The last byte.
 * @param p2 - The byte before it.
 */
function literalContext(mode: number, p1: number, p2: number): number {
	if (mode === 0) return p1 & 0x3f;
	if (mode === 1) return p1 >> 2;
	if (mode === 2) return (CONTEXT_LUT0[p1] ?? 0) | (CONTEXT_LUT1[p2] ?? 0);
	return ((CONTEXT_LUT2[p1] ?? 0) << 3) | (CONTEXT_LUT2[p2] ?? 0);
}

/**
 * Undoes the move-to-front coding of a context map in place.
 *
 * @param values - The context map.
 */
function inverseMoveToFront(values: Uint8Array): void {
	let order = Array.from({ length: 256 }, (_, index) => index);
	for (let index = 0; index < values.length; index++) {
		let position = values[index] ?? 0;
		let value = order[position] ?? 0;
		values[index] = value;
		order.splice(position, 1);
		order.unshift(value);
	}
}

/**
 * Applies a word transform: prefix, the elementary transform, suffix.
 *
 * @param base - The dictionary word.
 * @param transform - One of `BROTLI_TRANSFORMS`.
 */
function transformWord(base: Uint8Array, transform: readonly [string, number, string]): Uint8Array {
	let [prefix, kind, suffix] = transform;
	let start = kind >= 3 && kind <= 11 ? Math.min(kind - 2, base.length) : 0;
	let end = kind >= 12 ? Math.max(base.length - (kind - 11), 0) : base.length;
	let word = Uint8Array.from(base.subarray(start, Math.max(start, end)));
	if (kind === 1 && word.length > 0) ferment(word, 0);
	if (kind === 2) {
		for (let index = 0; index < word.length;) index += ferment(word, index);
	}
	let output = new Uint8Array(prefix.length + word.length + suffix.length);
	for (let index = 0; index < prefix.length; index++) output[index] = prefix.charCodeAt(index);
	output.set(word, prefix.length);
	for (let index = 0; index < suffix.length; index++) {
		output[prefix.length + word.length + index] = suffix.charCodeAt(index);
	}
	return output;
}

/**
 * Upper-cases one UTF-8 character in place the way the format defines it.
 *
 * @param word - The word being transformed.
 * @param index - Where the character starts.
 * @returns The character's byte length.
 */
function ferment(word: Uint8Array, index: number): number {
	let byte = word[index] ?? 0;
	if (byte < 192) {
		if (byte >= 97 && byte <= 122) word[index] = byte ^ 32;
		return 1;
	}
	if (byte < 224) {
		if (index + 1 < word.length) word[index + 1] = (word[index + 1] ?? 0) ^ 32;
		return 2;
	}
	if (index + 2 < word.length) word[index + 2] = (word[index + 2] ?? 0) ^ 5;
	return 3;
}

/** The static dictionary's bytes, decoded from base64 the first time a stream needs them. */
export function staticDictionary(): Uint8Array {
	if (DICTIONARY.bytes !== null) return DICTIONARY.bytes;
	let text = atob(BROTLI_DICTIONARY_BASE64);
	let bytes = new Uint8Array(text.length);
	for (let index = 0; index < text.length; index++) bytes[index] = text.charCodeAt(index);
	let offsets = [0];
	for (let length = 0; length < 24; length++) {
		let words = length < 4 ? 0 : 2 ** (DICTIONARY_BITS[length] ?? 0);
		offsets.push((offsets[length] ?? 0) + length * words);
	}
	DICTIONARY.offsets = offsets;
	DICTIONARY.bytes = bytes;
	return bytes;
}

/** Builds `Lut0`: the first 128 entries as listed, then the UTF-8 continuation pattern. */
function utf8LastByteContext(): Uint8Array {
	let ascii = [
		0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		8, 12, 16, 12, 12, 20, 12, 16, 24, 28, 12, 12, 32, 12, 36, 12, 44, 44, 44, 44, 44, 44, 44, 44,
		44, 44, 32, 32, 24, 40, 28, 12, 12, 48, 52, 52, 52, 48, 52, 52, 52, 48, 52, 52, 52, 52, 52, 48,
		52, 52, 52, 52, 52, 48, 52, 52, 52, 52, 52, 24, 12, 28, 12, 12, 12, 56, 60, 60, 60, 56, 60, 60,
		60, 56, 60, 60, 60, 60, 60, 56, 60, 60, 60, 60, 60, 56, 60, 60, 60, 60, 60, 24, 12, 28, 12, 0,
	];
	let table = new Uint8Array(256);
	table.set(ascii);
	for (let index = 128; index < 256; index++) table[index] = (index & 1) + (index >= 192 ? 2 : 0);
	return table;
}

/** Builds `Lut1` from its rows of 16 one-digit entries. */
function utf8SecondByteContext(): Uint8Array {
	let rows = [
		"0000000000000000",
		"0000000000000000",
		"0111111111111111",
		"2222222222111111",
		"1222222222222222",
		"2222222222211111",
		"1333333333333333",
		"3333333333311110",
	];
	let table = new Uint8Array(256);
	let digits = rows.join("");
	for (let index = 0; index < digits.length; index++) table[index] = digits.charCodeAt(index) - 48;
	table.fill(2, 224);
	return table;
}

/** Builds `Lut2`, which groups bytes by magnitude into eight classes. */
function signedContext(): Uint8Array {
	let table = new Uint8Array(256);
	table.fill(1, 1, 16);
	table.fill(2, 16, 64);
	table.fill(3, 64, 128);
	table.fill(4, 128, 192);
	table.fill(5, 192, 240);
	table.fill(6, 240, 255);
	table[255] = 7;
	return table;
}
