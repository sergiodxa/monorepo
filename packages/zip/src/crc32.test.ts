/**
 * Checks the checksum against the standard CRC-32 check value and confirms that feeding
 * chunks through `previous` matches one call over the whole buffer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { crc32 } from "./crc32.js";

describe("crc32", () => {
	test("answers the standard check value for 123456789", () => {
		expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
	});

	test("answers 0 for no bytes", () => {
		expect(crc32(new Uint8Array())).toBe(0);
	});

	test("answers an unsigned value", () => {
		expect(crc32(new Uint8Array([0xff, 0xff, 0xff, 0xff]))).toBe(0xffffffff);
	});

	test("continues across chunks to the value of the whole buffer", () => {
		let bytes = new TextEncoder().encode("The quick brown fox jumps over the lazy dog");
		let running = 0;
		for (let start = 0; start < bytes.length; start += 7) {
			running = crc32(bytes.subarray(start, start + 7), running);
		}
		expect(running).toBe(crc32(bytes));
		expect(running).toBe(0x414fa339);
	});
});
