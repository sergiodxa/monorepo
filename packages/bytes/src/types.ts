/**
 * The byte size vocabulary for any API that takes a limit or a quota: a
 * compile-time-checked size string and the input union consumers declare. A bare
 * number is always bytes, so a unit is never inferred silently.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BigByteUnit, BigByteUnitShort, ByteUnit, ByteUnitShort } from "./units.js";

/**
 * A byte size written as text: a whole amount plus a unit name after a space, or
 * a unit symbol with or without one. The amount is `${bigint}`, so only whole,
 * canonical amounts such as `10` type-check.
 *
 * @example
 * let maxUpload: ByteSizeString = "10 MiB";
 * @example
 * let quota: ByteSizeString = "5GB";
 */
export type ByteSizeString =
	| `${bigint} ${ByteUnit}`
	| `${bigint} ${ByteUnitShort}`
	| `${bigint}${ByteUnitShort}`;

/**
 * What a size-taking API declares: a checked size string, or a bare number
 * already counted in bytes. Consumers normalize internally with `toBytes()`.
 *
 * @example
 * function limit(max: ByteSizeInput) { return (size: number) => size <= toBytes(max); }
 */
export type ByteSizeInput = number | ByteSizeString;

/**
 * A byte size for `toBytesBigInt()`: every `ByteSizeString` form, plus the units
 * from exa and exbi through yotta and yobi that only a bigint holds exactly.
 *
 * @example
 * let archive: BigByteSizeString = "2 EiB";
 */
export type BigByteSizeString =
	| `${bigint} ${BigByteUnit}`
	| `${bigint} ${BigByteUnitShort}`
	| `${bigint}${BigByteUnitShort}`;

/**
 * What a bigint size-taking API declares: a checked size string, or a bigint
 * already counted in bytes.
 */
export type BigByteSizeInput = bigint | BigByteSizeString;
