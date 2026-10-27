/**
 * A forward-only big-endian cursor over one WOFF2 stream, with the format's variable-length
 * integers. Reads past the end answer zeros and set `overrun`, so a decoder checks once per
 * record instead of guarding every field.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Reads a byte range front to back; `overrun` reports a read past its end. */
export class Cursor {
	/** Set once a read went past the end of the range. */
	overrun = false;
	#bytes: Uint8Array;
	#position: number;

	/**
	 * @param bytes - The stream; the cursor starts at its first byte.
	 */
	constructor(bytes: Uint8Array) {
		this.#bytes = bytes;
		this.#position = 0;
	}

	/** Bytes read so far. */
	get position(): number {
		return this.#position;
	}

	/** Bytes left before the end. */
	get remaining(): number {
		return Math.max(this.#bytes.length - this.#position, 0);
	}

	/** An unsigned byte. */
	u8(): number {
		let value = this.#bytes[this.#position];
		this.#position += 1;
		if (value === undefined) {
			this.overrun = true;
			return 0;
		}
		return value;
	}

	/** An unsigned 16-bit integer. */
	u16(): number {
		return (this.u8() << 8) | this.u8();
	}

	/** A signed 16-bit integer. */
	i16(): number {
		return (this.u16() << 16) >> 16;
	}

	/** An unsigned 32-bit integer. */
	u32(): number {
		return this.u16() * 0x10000 + this.u16();
	}

	/** A four-character tag. */
	tag(): string {
		return String.fromCharCode(this.u8(), this.u8(), this.u8(), this.u8());
	}

	/** A `255UInt16`: one byte below 253, or a marker byte and one or two more bytes. */
	u255(): number {
		let code = this.u8();
		if (code === 253) return this.u16();
		if (code === 255) return this.u8() + 253;
		if (code === 254) return this.u8() + 506;
		return code;
	}

	/**
	 * A `UIntBase128`: up to five bytes of seven bits each, most significant first.
	 *
	 * @returns The value, or `-1` for a leading zero byte, an overflow or a sixth byte.
	 */
	base128(): number {
		let value = 0;
		for (let index = 0; index < 5; index++) {
			let byte = this.u8();
			if (index === 0 && byte === 0x80) return -1;
			if (value >= 2 ** 25) return -1;
			value = value * 128 + (byte & 0x7f);
			if ((byte & 0x80) === 0) return value;
		}
		return -1;
	}

	/**
	 * Bytes already passed, as a view of the stream.
	 *
	 * @param start - Where they start.
	 * @param length - How many.
	 */
	view(start: number, length: number): Uint8Array {
		let end = Math.min(start + length, this.#bytes.length);
		return this.#bytes.subarray(Math.min(start, end), end);
	}

	/**
	 * The next `count` bytes as a view of the stream.
	 *
	 * @param count - How many bytes.
	 */
	bytes(count: number): Uint8Array {
		let start = this.#position;
		this.#position += count;
		if (this.#position > this.#bytes.length) this.overrun = true;
		return this.#bytes.subarray(start, Math.min(this.#position, this.#bytes.length));
	}
}
