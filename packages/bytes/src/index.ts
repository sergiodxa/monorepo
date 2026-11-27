/**
 * Public surface of the bytes package: the byte size string types, the input
 * unions consumers declare, the conversions to a number or a bigint of bytes,
 * and the runtime parsers with their error.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type {
	BigByteSizeInput,
	BigByteSizeString,
	ByteSizeInput,
	ByteSizeString,
} from "./types.js";
export type { BigByteUnit, BigByteUnitShort, ByteUnit, ByteUnitShort } from "./units.js";

export { InvalidByteSizeError } from "./invalid-byte-size-error.js";
export { parse, parseBigInt } from "./parse.js";
export { toBytes } from "./to-bytes.js";
export { toBytesBigInt } from "./to-bytes-big-int.js";
