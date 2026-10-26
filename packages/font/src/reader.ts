/**
 * Big-endian reads over a font's bytes that answer `0` past the end, so table code walks
 * offsets taken from the file itself without ever raising a `RangeError` on a truncated or
 * hostile font; structural checks happen once, in `parseFont`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Bounds-checked reader over one font file. Every read past `length` returns `0`, which
 * every table walker treats as an empty count, so a corrupt offset ends a loop early.
 */
export class Reader {
	/** Size of the font file in bytes. */
	readonly length: number;
	#view: DataView;
	#bytes: Uint8Array;

	/**
	 * @param bytes - The whole font file; a view's `byteOffset` is respected.
	 */
	constructor(bytes: Uint8Array) {
		this.#view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		this.#bytes = bytes;
		this.length = bytes.byteLength;
	}

	/** @param offset - Absolute byte offset. */
	u8(offset: number): number {
		if (offset < 0 || offset + 1 > this.length) return 0;
		return this.#view.getUint8(offset);
	}

	/** @param offset - Absolute byte offset. */
	i8(offset: number): number {
		if (offset < 0 || offset + 1 > this.length) return 0;
		return this.#view.getInt8(offset);
	}

	/** @param offset - Absolute byte offset. */
	u16(offset: number): number {
		if (offset < 0 || offset + 2 > this.length) return 0;
		return this.#view.getUint16(offset);
	}

	/** @param offset - Absolute byte offset. */
	i16(offset: number): number {
		if (offset < 0 || offset + 2 > this.length) return 0;
		return this.#view.getInt16(offset);
	}

	/** @param offset - Absolute byte offset. */
	u32(offset: number): number {
		if (offset < 0 || offset + 4 > this.length) return 0;
		return this.#view.getUint32(offset);
	}

	/**
	 * A view of `length` bytes from `offset`, sharing the file's buffer and cut short at the
	 * end of the file.
	 *
	 * @param offset - Absolute byte offset.
	 * @param length - How many bytes.
	 */
	bytes(offset: number, length: number): Uint8Array {
		let start = Math.min(Math.max(offset, 0), this.length);
		let end = Math.min(start + Math.max(length, 0), this.length);
		return this.#bytes.subarray(start, end);
	}

	/**
	 * A 2.14 fixed-point number, the format composite glyphs store their scales in.
	 *
	 * @param offset - Absolute byte offset.
	 */
	f2dot14(offset: number): number {
		return this.i16(offset) / 16384;
	}

	/**
	 * A four-character table or feature tag, empty past the end of the file.
	 *
	 * @param offset - Absolute byte offset.
	 */
	tag(offset: number): string {
		if (offset < 0 || offset + 4 > this.length) return "";
		return String.fromCharCode(
			this.u8(offset),
			this.u8(offset + 1),
			this.u8(offset + 2),
			this.u8(offset + 3),
		);
	}
}
