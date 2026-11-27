/**
 * Conversion to bytes as a bigint, for sizes past what a number holds exactly:
 * exabyte quotas, aggregate storage totals, and sums that outgrow 8 PiB. It
 * shares `toBytes()`'s grammar and adds the units from exa through yotta.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isSuccess } from "@sdxc/result";

import type { BigByteSizeInput } from "./types.js";

import { parseBigInt } from "./parse.js";

/**
 * Convert a byte size to a bigint of bytes; a bigint passes through untouched.
 * Text that bypassed the type throws its `InvalidByteSizeError`, since a bigint
 * has no `NaN` to carry it; `parseBigInt()` reports the same case as a failure.
 *
 * @param input - A byte size string, or a bigint of bytes.
 * @returns The size in bytes.
 * @throws {InvalidByteSizeError} When text reaches it behind a type cast.
 *
 * @example
 * toBytesBigInt("2 EiB"); // 2305843009213693952n
 * @example
 * toBytesBigInt("10 MiB"); // 10485760n
 */
export function toBytesBigInt(input: BigByteSizeInput): bigint {
	if (typeof input === "bigint") return input;
	let result = parseBigInt(input);
	if (isSuccess(result)) return result.data;
	throw result.error;
}
