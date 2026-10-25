/**
 * Byte-string helpers shared by the decoder and the encoder: the bytewise order deterministic
 * map keys sort in, and a string form of bytes for use as a set key.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Orders two byte strings bytewise, a shorter prefix first, as deterministic map keys sort.
 *
 * @returns Negative, zero or positive as `left` sorts before, equal to or after `right`.
 */
export function compareBytes(left: Uint8Array, right: Uint8Array): number {
	let shared = Math.min(left.length, right.length);
	for (let index = 0; index < shared; index++) {
		let difference = (left[index] as number) - (right[index] as number);
		if (difference !== 0) return difference;
	}
	return left.length - right.length;
}

/**
 * A string with one character per byte, used as a set key for encoded map keys.
 *
 * @param bytes Any bytes.
 */
export function latin1(bytes: Uint8Array): string {
	let text = "";
	for (let index = 0; index < bytes.length; index += 0x1000) {
		text += String.fromCharCode(...bytes.subarray(index, index + 0x1000));
	}
	return text;
}
