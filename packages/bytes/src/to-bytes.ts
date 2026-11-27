/**
 * Conversion to bytes, the unit `Blob.size`, `Content-Length` and stream reads
 * count in. This is the normalization every consumer runs on the
 * `ByteSizeInput` it declares, so call sites read `"10 MiB"` instead of a
 * product of 1024s.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isSuccess } from "@sdxc/result";

import type { ByteSizeInput } from "./types.js";

import { parse } from "./parse.js";

/**
 * Convert a byte size to bytes. A bare number is already bytes and passes
 * through untouched, keeping existing numeric call sites intact. Text that
 * bypassed the type yields `NaN`; `parse()` is the entry point that reports why.
 *
 * @param input - A byte size string, or a number of bytes.
 * @returns The size in bytes, or `NaN` if the type was bypassed.
 *
 * @example
 * toBytes("10 MiB"); // 10485760
 * @example
 * toBytes("10 MB"); // 10000000
 * @example
 * toBytes(512); // 512
 */
export function toBytes(input: ByteSizeInput): number {
	if (typeof input === "number") return input;
	let result = parse(input);
	if (isSuccess(result)) return result.data;
	return Number.NaN;
}
