/**
 * IEEE 754 half-precision conversion, which JavaScript has no built-in for, and the choice of
 * the shortest float width that holds a number exactly, which preferred serialization requires.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The half-precision bit pattern of the one NaN deterministic encoding writes. */
export const CANONICAL_NAN_BITS = 0x7e00;

/**
 * Expands a half-precision bit pattern into the number it encodes.
 *
 * @param bits The sixteen bits as an integer.
 * @returns The value, with every NaN payload collapsed to `NaN`.
 */
export function readFloat16(bits: number): number {
	let sign = bits & 0x8000 ? -1 : 1;
	let exponent = (bits >> 10) & 0x1f;
	let fraction = bits & 0x3ff;
	if (exponent === 0) return sign * 2 ** -24 * fraction;
	if (exponent === 0x1f) return fraction ? Number.NaN : sign * Number.POSITIVE_INFINITY;
	return sign * 2 ** (exponent - 25) * (0x400 + fraction);
}

/**
 * The half-precision bit pattern holding `value` exactly, when one does.
 *
 * @param value Any number.
 * @returns The sixteen bits, or `undefined` when half precision would round the value.
 */
export function toFloat16(value: number): number | undefined {
	if (Number.isNaN(value)) return CANONICAL_NAN_BITS;
	let sign = value < 0 || Object.is(value, -0) ? 0x8000 : 0;
	let magnitude = Math.abs(value);
	if (magnitude === Number.POSITIVE_INFINITY) return sign | 0x7c00;
	if (magnitude < 2 ** -14) {
		let fraction = magnitude * 2 ** 24;
		return Number.isInteger(fraction) ? sign | fraction : undefined;
	}
	let exponent = Math.floor(Math.log2(magnitude));
	if (2 ** exponent > magnitude) exponent -= 1;
	if (2 ** (exponent + 1) <= magnitude) exponent += 1;
	if (exponent > 15) return undefined;
	let fraction = (magnitude / 2 ** exponent - 1) * 0x400;
	if (!Number.isInteger(fraction)) return undefined;
	return sign | ((exponent + 15) << 10) | fraction;
}

/**
 * The fewest bytes, 2, 4 or 8, a float encoding of `value` needs without changing it.
 *
 * @param value Any number.
 * @returns The width preferred serialization writes it in.
 */
export function floatWidth(value: number): 2 | 4 | 8 {
	if (toFloat16(value) !== undefined) return 2;
	if (Math.fround(value) === value) return 4;
	return 8;
}
