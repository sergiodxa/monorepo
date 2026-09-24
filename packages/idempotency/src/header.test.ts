/**
 * Tests for the `Idempotency-Key` field: an sf-string Item whose parameters are ignored,
 * refused when unquoted, empty or over the length bound, and written back quoted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { IdempotencyKeyError } from "./errors.js";
import { formatIdempotencyKey, IDEMPOTENCY_KEY_HEADER, readIdempotencyKey } from "./header.js";

/** Headers carrying one `Idempotency-Key` field line. */
function withKey(value: string): Headers {
	return new Headers({ [IDEMPOTENCY_KEY_HEADER]: value });
}

describe("readIdempotencyKey", () => {
	test("reads a quoted key", () => {
		let key = unwrap(readIdempotencyKey(withKey('"8e03978e-40d5-43e8-bc93-6894a57f9324"')));
		expect(key).toBe("8e03978e-40d5-43e8-bc93-6894a57f9324");
	});

	test("succeeds with null when the header is absent", () => {
		expect(unwrap(readIdempotencyKey(new Headers()))).toBeNull();
	});

	test("unescapes the sf-string", () => {
		expect(unwrap(readIdempotencyKey(withKey('"a\\"b\\\\c"')))).toBe('a"b\\c');
	});

	test("ignores parameters on the item", () => {
		expect(unwrap(readIdempotencyKey(withKey('"abc";v=1')))).toBe("abc");
	});

	test.each([
		["an unquoted token", "abc"],
		["an integer", "42"],
		["a display string", '%"abc"'],
		["an unterminated string", '"abc'],
		["an empty string", '""'],
		["a list of strings", '"a", "b"'],
	])("refuses %s as invalid", (_, value) => {
		let result = readIdempotencyKey(withKey(value));
		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error).toBeInstanceOf(IdempotencyKeyError);
		expect(result.error.reason).toBe("invalid");
	});

	test("refuses a key over 255 characters by default", () => {
		expect(unwrap(readIdempotencyKey(withKey(`"${"a".repeat(255)}"`)))).toHaveLength(255);

		let result = readIdempotencyKey(withKey(`"${"a".repeat(256)}"`));
		expect(isFailure(result) && result.error.reason).toBe("too-long");
	});

	test("honors a caller's length bound", () => {
		let result = readIdempotencyKey(withKey('"abcdef"'), { maxLength: 5 });
		expect(isFailure(result) && result.error.reason).toBe("too-long");
	});
});

describe("formatIdempotencyKey", () => {
	test("quotes and escapes the key", () => {
		expect(unwrap(formatIdempotencyKey("abc"))).toBe('"abc"');
		expect(unwrap(formatIdempotencyKey('a"b\\c'))).toBe('"a\\"b\\\\c"');
	});

	test("round-trips through readIdempotencyKey", () => {
		let key = 'retry "7" of job\\42';
		let header = unwrap(formatIdempotencyKey(key));
		expect(unwrap(readIdempotencyKey(withKey(header)))).toBe(key);
	});

	test.each([
		["a non-ASCII character", "café"],
		["a control character", "a\nb"],
		["the empty string", ""],
	])("refuses %s", (_, key) => {
		let result = formatIdempotencyKey(key);
		expect(isFailure(result) && result.error.reason).toBe("invalid");
	});
});
