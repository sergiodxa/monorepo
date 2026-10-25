/**
 * CBOR (RFC 8949): decoding with bounded depth and item count for untrusted input, and
 * deterministic encoding for bytes that must hash or sign the same every time. Import it as
 * a namespace, `import * as CBOR from "@sdxc/cbor"`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export type { DecodedPrefix, DecodeOptions } from "./decode.js";
export type { CBORErrorCode } from "./errors.js";
export type { CBORValue } from "./values.js";

export { decode, decodeFirst } from "./decode.js";
export { encode } from "./encode.js";
export { CBORError } from "./errors.js";
export { Simple, Tagged } from "./values.js";
