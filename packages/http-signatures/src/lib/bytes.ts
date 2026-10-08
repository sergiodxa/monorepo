/**
 * Reads the payload forms this package accepts as bytes Web Crypto takes, so a body passed
 * as text digests to the same UTF-8 bytes the request sends.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BinaryLike, Bytes } from "@sdxc/crypto";

/** Shared UTF-8 encoder for text payloads and signature bases. */
const ENCODER = new TextEncoder();

/**
 * Bytes of a payload: text as UTF-8, binary as a view over a plain `ArrayBuffer`.
 *
 * @param data - Text or binary payload.
 */
export function toBytes(data: BinaryLike): Bytes {
	if (typeof data === "string") return ENCODER.encode(data);
	if (data instanceof ArrayBuffer) return new Uint8Array(data);
	if (data.buffer instanceof ArrayBuffer) return data as Bytes;
	return new Uint8Array(data);
}
