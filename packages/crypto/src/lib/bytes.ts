/**
 * Byte conversion helpers shared by every module in this package.
 *
 * One `TextEncoder`/`TextDecoder` pair is reused so string payloads always turn
 * into the same UTF-8 bytes, and every public function can accept text or binary
 * without each module re-deciding what "data" means.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Shared UTF-8 encoder, so string inputs hash and sign identically everywhere. */
const ENCODER = new TextEncoder();

/** Shared UTF-8 decoder used to read plaintext back out of byte buffers. */
const DECODER = new TextDecoder();

/**
 * Data accepted wherever this package takes "bytes": text is read as UTF-8.
 *
 * @example
 * await sha256("hello");
 * await sha256(new Uint8Array([1, 2, 3]));
 */
export type BinaryLike = string | Uint8Array | ArrayBuffer;

/**
 * Byte buffers this package produces: views over a non-shared `ArrayBuffer`.
 *
 * WebCrypto refuses views backed by a `SharedArrayBuffer`, so every function that
 * returns bytes returns them in a form that can be fed straight back in.
 */
export type Bytes = Uint8Array<ArrayBuffer>;

/**
 * Normalizes any accepted input into bytes WebCrypto will accept.
 *
 * Strings are encoded as UTF-8 and an `ArrayBuffer` is wrapped rather than cloned,
 * so callers must not mutate a buffer they have handed over. The one case that
 * copies is a view over a `SharedArrayBuffer`, which WebCrypto rejects outright.
 *
 * @param data Text or binary payload.
 * @returns Bytes backing the payload.
 */
export function toBytes(data: BinaryLike): Bytes {
	if (typeof data === "string") return ENCODER.encode(data);
	if (data instanceof ArrayBuffer) return new Uint8Array(data);
	if (data.buffer instanceof ArrayBuffer) return data as Bytes;
	return new Uint8Array(data);
}

/**
 * Decodes bytes as UTF-8 text, replacing invalid sequences instead of failing.
 *
 * Authenticated decryption already proves the bytes are the ones that were
 * sealed, so a lossy decode here can only mean the plaintext was not UTF-8.
 *
 * @param bytes Bytes to read as text.
 * @returns Decoded string.
 */
export function toText(bytes: Uint8Array): string {
	return DECODER.decode(bytes);
}
