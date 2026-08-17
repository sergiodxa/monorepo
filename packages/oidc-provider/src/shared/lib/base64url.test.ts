import { describe, expect, test } from "vitest";

import { base64UrlDecode, base64UrlEncode } from "./base64url";

describe("base64url", () => {
	describe("base64UrlEncode", () => {
		test("encodes bytes to base64url", () => {
			let bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
			expect(base64UrlEncode(bytes)).toBe("SGVsbG8");
		});

		test("replaces + with -", () => {
			// Bytes that produce + in standard base64
			let bytes = new Uint8Array([251, 239]);
			let result = base64UrlEncode(bytes);
			expect(result).not.toContain("+");
		});

		test("replaces / with _", () => {
			// Bytes that produce / in standard base64
			let bytes = new Uint8Array([255, 255]);
			let result = base64UrlEncode(bytes);
			expect(result).not.toContain("/");
		});

		test("removes padding", () => {
			let bytes = new Uint8Array([72]); // Would be "SA==" in base64
			let result = base64UrlEncode(bytes);
			expect(result).not.toContain("=");
		});
	});

	describe("base64UrlDecode", () => {
		test("decodes base64url to bytes", () => {
			let result = base64UrlDecode("SGVsbG8");
			expect(Array.from(result)).toEqual([72, 101, 108, 108, 111]); // "Hello"
		});

		test("handles - character", () => {
			let encoded = base64UrlEncode(new Uint8Array([251, 239]));
			let decoded = base64UrlDecode(encoded);
			expect(Array.from(decoded)).toEqual([251, 239]);
		});

		test("handles _ character", () => {
			let encoded = base64UrlEncode(new Uint8Array([255, 255]));
			let decoded = base64UrlDecode(encoded);
			expect(Array.from(decoded)).toEqual([255, 255]);
		});

		test("handles missing padding", () => {
			// "SA" without padding should decode to [72]
			let result = base64UrlDecode("SA");
			expect(Array.from(result)).toEqual([72]);
		});
	});

	describe("roundtrip", () => {
		test("encode then decode returns original", () => {
			let original = crypto.getRandomValues(new Uint8Array(32));
			let encoded = base64UrlEncode(original);
			let decoded = base64UrlDecode(encoded);
			expect(Array.from(decoded)).toEqual(Array.from(original));
		});
	});
});
