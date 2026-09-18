/**
 * Converts an ECDSA signature from the DER encoding authenticators emit into
 * the fixed-width `r || s` pair WebCrypto verifies against.
 *
 * WebAuthn signs with the X9.62 form, where each integer is variable length and
 * may carry a leading zero for sign, while WebCrypto takes both halves padded
 * to the curve's field size, so one of the two has to be rewritten.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import { MalformedResponseError } from "../errors.js";

/** DER tag introducing a constructed sequence. */
const SEQUENCE_TAG = 0x30;

/** DER tag introducing an integer. */
const INTEGER_TAG = 0x02;

/** Length byte bit that marks a multi-byte length follows. */
const LONG_FORM_FLAG = 0x80;

/**
 * Reads one DER integer starting at `offset`, dropping its sign padding.
 *
 * @param bytes Signature being read.
 * @param offset Position of the integer's tag byte.
 * @returns The integer's magnitude and the offset just past it.
 */
function readInteger(bytes: Bytes, offset: number): [Bytes, number] {
	if (bytes[offset] !== INTEGER_TAG) throw new RangeError("expected a DER integer");
	let length = bytes[offset + 1] as number;
	if (length & LONG_FORM_FLAG) throw new RangeError("unsupported DER length");
	let start = offset + 2;
	let end = start + length;
	if (end > bytes.length) throw new RangeError("truncated DER integer");
	let value = bytes.subarray(start, end);
	while (value.length > 1 && value[0] === 0) value = value.subarray(1);
	return [value, end];
}

/**
 * Rewrites a DER-encoded ECDSA signature as the concatenated halves.
 *
 * @param signature Signature as the authenticator produced it.
 * @param size Bytes each half occupies, which is the curve's field size.
 * @returns The `r || s` bytes, or `MalformedResponseError` for anything not in this shape.
 * @example
 * let raw = toRawSignature(signature, 32);
 */
export function toRawSignature(
	signature: Bytes,
	size: number,
): Result<Bytes, MalformedResponseError> {
	try {
		if (signature[0] !== SEQUENCE_TAG) throw new RangeError("expected a DER sequence");
		let header = (signature[1] as number) & LONG_FORM_FLAG ? 3 : 2;
		let [r, afterR] = readInteger(signature, header);
		let [s] = readInteger(signature, afterR);
		if (r.length > size || s.length > size) throw new RangeError("integer wider than the curve");

		let raw = new Uint8Array(size * 2);
		raw.set(r, size - r.length);
		raw.set(s, size * 2 - s.length);
		return success(raw);
	} catch {
		return failure(new MalformedResponseError("undecodable ECDSA signature"));
	}
}
