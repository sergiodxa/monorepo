/**
 * Reads and writes the JSON a store holds, answering with a `Result` so a value
 * JSON cannot write and an entry it cannot read are reported rather than thrown.
 * Both halves live here so every adapter serializes a value the same way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { JSONSerialized } from "@sdxc/types";

import { failure, success } from "@sdxc/result";

import { CacheError } from "../errors.js";

/**
 * Writes the value as the text a store holds.
 *
 * @param key The entry being written, which the failure names.
 * @param value What the caller handed over.
 * @returns The text, or `invalid_value` when JSON cannot write it.
 */
export function serialize(key: string, value: unknown): Result<string, CacheError> {
	let text: string | undefined;

	try {
		text = JSON.stringify(value);
	} catch (cause) {
		return failure(
			new CacheError(`The value for ${key} cannot be written as JSON.`, {
				code: "invalid_value",
				key,
				cause,
			}),
		);
	}

	if (text === undefined) {
		return failure(
			new CacheError(`The value for ${key} has no JSON notation.`, {
				code: "invalid_value",
				key,
			}),
		);
	}

	return success(text);
}

/**
 * Reads a stored entry back.
 *
 * @param key The entry being read, which the failure names.
 * @param text What the store held.
 * @returns The value, or `invalid_value` when the entry is not JSON.
 */
export function parse<T>(key: string, text: string): Result<JSONSerialized<T>, CacheError> {
	try {
		return success(JSON.parse(text) as JSONSerialized<T>);
	} catch (cause) {
		return failure(
			new CacheError(`The entry stored for ${key} is not JSON.`, {
				code: "invalid_value",
				key,
				cause,
			}),
		);
	}
}
