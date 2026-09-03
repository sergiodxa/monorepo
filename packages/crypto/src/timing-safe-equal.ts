/**
 * Constant-time byte comparison for secrets, signatures, and one-time codes.
 *
 * Comparing sensitive values with `===` or a loop that returns early leaks how
 * many leading bytes matched, which is enough to forge a signature one byte at a
 * time; this exists so no module in the repository needs `node:crypto` for it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BinaryLike } from "./lib/bytes.js";

import { toBytes } from "./lib/bytes.js";

/**
 * Compares two values byte for byte without an early exit.
 *
 * The running time depends only on the length of the inputs; length leaks but
 * byte content stays protected. Strings compare as their UTF-8 bytes.
 *
 * @param left First value, typically the expected one.
 * @param right Second value, typically the one supplied by a caller.
 * @returns Whether both values contain exactly the same bytes.
 * @example
 * if (!timingSafeEqual(expectedSignature, providedSignature)) return reject();
 */
export function timingSafeEqual(left: BinaryLike, right: BinaryLike): boolean {
	let a = toBytes(left);
	let b = toBytes(right);

	if (a.length === 0 || b.length === 0) return a.length === b.length;

	let mismatch = a.length ^ b.length;
	for (let index = 0; index < a.length; index++) {
		mismatch |= (a[index] ?? 0) ^ (b[index % b.length] ?? 0);
	}

	return mismatch === 0;
}
