/**
 * Runtime parsing for byte sizes that arrive as text — configuration values,
 * form input — where the compile-time type cannot help. Both parsers share one
 * grammar, and a mismatch is a `Result` failure instead of a throw.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import { InvalidByteSizeError } from "./invalid-byte-size-error.js";
import {
	bigLongUnitToBytes,
	bigShortUnitToBytes,
	longUnitToBytes,
	shortUnitToBytes,
} from "./units.js";

/**
 * A whole amount in canonical form, an optional single space, then an optional
 * unit. Forms like `"1.5"`, `"5e3"` and `"05"` stay out of the amount.
 */
const SIZE_PATTERN = /^(?<amount>-?(?:0|[1-9][0-9]*))(?<space> ?)(?<unit>[A-Za-z]*)$/;

/** The pieces of size text that matched the grammar, before any unit lookup. */
interface SizeParts {
	amount: string;
	unit: string;
	spaced: boolean;
}

/** Split trimmed size text into its amount and unit, or `undefined` off-grammar. */
function matchSize(text: string): SizeParts | undefined {
	let groups = SIZE_PATTERN.exec(text.trim())?.groups;
	if (groups?.amount === undefined) return undefined;
	return { amount: groups.amount, unit: groups.unit ?? "", spaced: groups.space === " " };
}

/**
 * The size of one unit as written, or `undefined` when the unit is not accepted
 * with that spacing: names need the space, symbols take it or leave it, and a
 * bare amount takes none.
 */
function unitSize<T>(
	parts: SizeParts,
	one: T,
	short: (unit: string) => T | undefined,
	long: (unit: string) => T | undefined,
): T | undefined {
	if (parts.unit === "") return parts.spaced ? undefined : one;
	let symbol = short(parts.unit);
	if (symbol !== undefined) return symbol;
	if (parts.spaced) return long(parts.unit);
	return undefined;
}

/**
 * Parse byte size text into bytes, accepting exactly the forms `ByteSizeString`
 * allows plus a bare amount of bytes, with surrounding whitespace trimmed. A
 * result beyond `Number.MAX_SAFE_INTEGER` fails, since it could not be exact.
 *
 * @param text - Text to parse, e.g. an environment variable value.
 * @returns The size in bytes, or an `InvalidByteSizeError` naming the rejected text.
 *
 * @example
 * parse("10 MiB"); // { status: "success", data: 10485760 }
 * @example
 * parse("10 mb"); // { status: "failure", error: InvalidByteSizeError }
 * @example
 * parse("1048576"); // { status: "success", data: 1048576 }
 */
export function parse(text: string): Result<number, InvalidByteSizeError> {
	let parts = matchSize(text);
	if (!parts) return failure(new InvalidByteSizeError(text));

	let unit = unitSize(parts, 1, shortUnitToBytes, longUnitToBytes);
	if (unit === undefined) return failure(new InvalidByteSizeError(text));

	let total = Number(parts.amount) * unit;
	if (!Number.isSafeInteger(total)) return failure(new InvalidByteSizeError(text));
	return success(total);
}

/**
 * Parse byte size text into a bigint of bytes, accepting the forms
 * `BigByteSizeString` allows plus a bare amount of bytes. Every result is exact,
 * whatever its size.
 *
 * @param text - Text to parse, e.g. a storage quota from configuration.
 * @returns The size in bytes, or an `InvalidByteSizeError` naming the rejected text.
 *
 * @example
 * parseBigInt("2 EiB"); // { status: "success", data: 2305843009213693952n }
 * @example
 * parseBigInt("2 EB"); // { status: "success", data: 2000000000000000000n }
 */
export function parseBigInt(text: string): Result<bigint, InvalidByteSizeError> {
	let parts = matchSize(text);
	if (!parts) return failure(new InvalidByteSizeError(text));

	let unit = unitSize(parts, 1n, bigShortUnitToBytes, bigLongUnitToBytes);
	if (unit === undefined) return failure(new InvalidByteSizeError(text));
	return success(BigInt(parts.amount) * unit);
}
