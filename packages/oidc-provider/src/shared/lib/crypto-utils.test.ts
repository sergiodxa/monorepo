import { describe, expect, test } from "bun:test";

import { base64UrlDecode, base64UrlEncode, constantTimeCompare, hmacSign } from "./crypto-utils";

describe("hmacSign", () => {
	test("signs data with HMAC-SHA256", async () => {
		let signature = await hmacSign("hello world", "secret-key");
		expect(typeof signature).toBe("string");
		expect(signature.length).toBeGreaterThan(0);
	});

	test("returns consistent results for same input", async () => {
		let input = "test data";
		let secret = "my-secret";

		let signature1 = await hmacSign(input, secret);
		let signature2 = await hmacSign(input, secret);

		expect(signature1).toBe(signature2);
	});

	test("returns different results for different keys", async () => {
		let input = "test data";

		let signature1 = await hmacSign(input, "secret-1");
		let signature2 = await hmacSign(input, "secret-2");

		expect(signature1).not.toBe(signature2);
	});

	test("returns different results for different inputs", async () => {
		let secret = "my-secret";

		let signature1 = await hmacSign("input-1", secret);
		let signature2 = await hmacSign("input-2", secret);

		expect(signature1).not.toBe(signature2);
	});

	test("returns base64url-encoded signature", async () => {
		let signature = await hmacSign("test", "secret");

		// Base64url should not contain +, /, or =
		expect(signature).not.toContain("+");
		expect(signature).not.toContain("/");
		expect(signature).not.toContain("=");
	});

	test("throws error when secret is empty", async () => {
		expect(hmacSign("test", "")).rejects.toThrow("HMAC secret is required");
	});

	test("handles unicode input", async () => {
		let signature = await hmacSign("こんにちは", "secret");
		expect(typeof signature).toBe("string");
		expect(signature.length).toBeGreaterThan(0);
	});

	test("handles empty input string", async () => {
		let signature = await hmacSign("", "secret");
		expect(typeof signature).toBe("string");
		expect(signature.length).toBeGreaterThan(0);
	});
});

describe("base64UrlEncode", () => {
	test("encodes string to base64url", () => {
		let result = base64UrlEncode("Hello");
		expect(result).toBe("SGVsbG8");
	});

	test("encodes Uint8Array to base64url", () => {
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

	test("handles unicode strings", () => {
		let result = base64UrlEncode("こんにちは");
		expect(result).not.toContain("+");
		expect(result).not.toContain("/");
		expect(result).not.toContain("=");
	});

	test("handles empty string", () => {
		let result = base64UrlEncode("");
		expect(result).toBe("");
	});

	test("handles empty Uint8Array", () => {
		let result = base64UrlEncode(new Uint8Array([]));
		expect(result).toBe("");
	});
});

describe("base64UrlDecode", () => {
	test("decodes base64url to string", () => {
		let result = base64UrlDecode("SGVsbG8");
		expect(result).toBe("Hello");
	});

	test("handles - character", () => {
		let original = "test+value";
		let encoded = base64UrlEncode(original);
		let decoded = base64UrlDecode(encoded);
		expect(decoded).toBe(original);
	});

	test("handles _ character", () => {
		let original = "test/value";
		let encoded = base64UrlEncode(original);
		let decoded = base64UrlDecode(encoded);
		expect(decoded).toBe(original);
	});

	test("handles missing padding", () => {
		// "SA" without padding should decode to "H"
		let result = base64UrlDecode("SA");
		expect(result).toBe("H");
	});

	test("handles empty string", () => {
		let result = base64UrlDecode("");
		expect(result).toBe("");
	});
});

describe("base64url roundtrip", () => {
	test("encode then decode returns original string", () => {
		let original = "Hello, World!";
		let encoded = base64UrlEncode(original);
		let decoded = base64UrlDecode(encoded);
		expect(decoded).toBe(original);
	});

	test("encode then decode returns original for unicode", () => {
		let original = "こんにちは世界";
		let encoded = base64UrlEncode(original);
		let decoded = base64UrlDecode(encoded);
		expect(decoded).toBe(original);
	});

	test("encode then decode returns original for special characters", () => {
		let original = "!@#$%^&*()_+-=[]{}|;':\",./<>?";
		let encoded = base64UrlEncode(original);
		let decoded = base64UrlDecode(encoded);
		expect(decoded).toBe(original);
	});
});

describe("constantTimeCompare", () => {
	test("returns true for identical strings", () => {
		expect(constantTimeCompare("hello", "hello")).toBe(true);
	});

	test("returns false for different strings", () => {
		expect(constantTimeCompare("hello", "world")).toBe(false);
	});

	test("returns false for strings of different lengths", () => {
		expect(constantTimeCompare("short", "longer string")).toBe(false);
	});

	test("handles empty strings - both empty", () => {
		expect(constantTimeCompare("", "")).toBe(true);
	});

	test("handles empty strings - one empty", () => {
		expect(constantTimeCompare("", "not empty")).toBe(false);
		expect(constantTimeCompare("not empty", "")).toBe(false);
	});

	test("returns false for strings differing by one character", () => {
		expect(constantTimeCompare("hello", "hellp")).toBe(false);
	});

	test("returns false for strings with same characters but different order", () => {
		expect(constantTimeCompare("abc", "cba")).toBe(false);
	});

	test("handles unicode strings", () => {
		expect(constantTimeCompare("こんにちは", "こんにちは")).toBe(true);
		expect(constantTimeCompare("こんにちは", "こんにちわ")).toBe(false);
	});

	test("handles special characters", () => {
		let str = "!@#$%^&*()";
		expect(constantTimeCompare(str, str)).toBe(true);
		expect(constantTimeCompare(str, "!@#$%^&*()_")).toBe(false);
	});

	test("handles long strings", () => {
		let longStr = "a".repeat(10000);
		expect(constantTimeCompare(longStr, longStr)).toBe(true);
		expect(constantTimeCompare(longStr, longStr + "b")).toBe(false);
	});

	test("is case sensitive", () => {
		expect(constantTimeCompare("Hello", "hello")).toBe(false);
	});
});

describe("hmac verification pattern", () => {
	test("can verify signature using hmacSign and constantTimeCompare", async () => {
		let data = "important data";
		let secret = "my-secret-key";

		// Sign the data
		let signature = await hmacSign(data, secret);

		// Verify by re-signing and comparing
		let expectedSignature = await hmacSign(data, secret);
		expect(constantTimeCompare(signature, expectedSignature)).toBe(true);
	});

	test("verification fails for tampered data", async () => {
		let originalData = "important data";
		let tamperedData = "tampered data";
		let secret = "my-secret-key";

		// Sign the original data
		let signature = await hmacSign(originalData, secret);

		// Try to verify with tampered data
		let tamperedSignature = await hmacSign(tamperedData, secret);
		expect(constantTimeCompare(signature, tamperedSignature)).toBe(false);
	});

	test("verification fails for wrong secret", async () => {
		let data = "important data";
		let correctSecret = "correct-secret";
		let wrongSecret = "wrong-secret";

		// Sign with correct secret
		let signature = await hmacSign(data, correctSecret);

		// Try to verify with wrong secret
		let wrongSignature = await hmacSign(data, wrongSecret);
		expect(constantTimeCompare(signature, wrongSignature)).toBe(false);
	});
});
