/**
 * Tests for the hex, base64, and base64url codecs.
 *
 * Round-trip cases pin the canonical output shape (lowercase hex, padded base64,
 * unpadded base64url) and the rejection cases pin that a malformed string is
 * rejected as a whole, since a partial decode would let a truncated signature
 * compare equal.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess, unwrap } from "@pkg/result";
import { describe, expect, test } from "vitest";

import { Base64, Base64Url, Hex } from "./encoding";
import { InvalidEncodingError } from "./errors";

describe("Hex", () => {
	test("encodes bytes as lowercase hex", () => {
		expect(Hex.encode(new Uint8Array([0, 15, 16, 255]))).toBe("000f10ff");
	});

	test("encodes text as its UTF-8 bytes", () => {
		expect(Hex.encode("hi")).toBe("6869");
	});

	test("round-trips arbitrary bytes", () => {
		let bytes = new Uint8Array(256);
		for (let index = 0; index < bytes.length; index++) bytes[index] = index;

		expect(unwrap(Hex.decode(Hex.encode(bytes)))).toEqual(bytes);
	});

	test("decodes uppercase input", () => {
		expect(unwrap(Hex.decode("FF00"))).toEqual(new Uint8Array([255, 0]));
	});

	test("round-trips the empty value", () => {
		expect(Hex.encode(new Uint8Array())).toBe("");
		expect(unwrap(Hex.decode(""))).toEqual(new Uint8Array());
	});

	test("fails on an odd length", () => {
		let result = Hex.decode("abc");
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(InvalidEncodingError);
	});

	test("fails on a non-hex character", () => {
		expect(isFailure(Hex.decode("zz"))).toBe(true);
		expect(isFailure(Hex.decode("ff 00"))).toBe(true);
	});

	test("keeps the offending input out of the error message", () => {
		let result = Hex.decode("secret-ish");
		if (!isFailure(result)) throw new Error("expected a failure");
		expect(result.error.message).not.toContain("secret");
	});
});

describe("Base64Url", () => {
	test("encodes without padding and only with URL-safe characters", () => {
		let encoded = Base64Url.encode(new Uint8Array([251, 255, 190, 255]));

		expect(encoded).not.toContain("=");
		expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
	});

	test("uses the URL-safe alphabet where standard base64 uses + and /", () => {
		expect(Base64Url.encode(new Uint8Array([255, 224]))).toBe("_-A");
	});

	test("round-trips arbitrary bytes", () => {
		let bytes = new Uint8Array(256);
		for (let index = 0; index < bytes.length; index++) bytes[index] = 255 - index;

		expect(unwrap(Base64Url.decode(Base64Url.encode(bytes)))).toEqual(bytes);
	});

	test("round-trips text through UTF-8", () => {
		let encoded = Base64Url.encode("héllo → world");
		expect(new TextDecoder().decode(unwrap(Base64Url.decode(encoded)))).toBe("héllo → world");
	});

	test("accepts padded input", () => {
		expect(unwrap(Base64Url.decode("aGk="))).toEqual(unwrap(Base64Url.decode("aGk")));
	});

	test("round-trips the empty value", () => {
		expect(Base64Url.encode(new Uint8Array())).toBe("");
		expect(unwrap(Base64Url.decode(""))).toEqual(new Uint8Array());
	});

	test("rejects the standard base64 alphabet", () => {
		expect(isFailure(Base64Url.decode("a+b/"))).toBe(true);
	});

	test("fails on a length that cannot hold whole bytes", () => {
		let result = Base64Url.decode("a");
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(InvalidEncodingError);
	});

	test("fails on characters outside the alphabet", () => {
		expect(isSuccess(Base64Url.decode("abc$"))).toBe(false);
	});

	test("encodes the RFC 4648 §10 vectors in the URL-safe alphabet", () => {
		expect(Base64Url.encode("")).toBe("");
		expect(Base64Url.encode("f")).toBe("Zg");
		expect(Base64Url.encode("fo")).toBe("Zm8");
		expect(Base64Url.encode("foo")).toBe("Zm9v");
		expect(Base64Url.encode("foob")).toBe("Zm9vYg");
		expect(Base64Url.encode("fooba")).toBe("Zm9vYmE");
		expect(Base64Url.encode("foobar")).toBe("Zm9vYmFy");
	});

	test("encodes a length of every remainder, one, two, and zero bytes past a group", () => {
		let bytes = new Uint8Array([0, 1, 2, 3, 4, 5]);

		expect(Base64Url.encode(bytes.subarray(0, 0))).toBe("");
		expect(Base64Url.encode(bytes.subarray(0, 1))).toBe("AA");
		expect(Base64Url.encode(bytes.subarray(0, 2))).toBe("AAE");
		expect(Base64Url.encode(bytes.subarray(0, 3))).toBe("AAEC");
		expect(Base64Url.encode(bytes.subarray(0, 4))).toBe("AAECAw");
		expect(Base64Url.encode(bytes.subarray(0, 5))).toBe("AAECAwQ");
		expect(Base64Url.encode(bytes.subarray(0, 6))).toBe("AAECAwQF");
	});

	test("round-trips a length of every remainder", () => {
		let bytes = new Uint8Array([9, 8, 7, 6, 5, 4, 3]);

		for (let length = 0; length <= bytes.length; length++) {
			let payload = bytes.slice(0, length);
			expect(unwrap(Base64Url.decode(Base64Url.encode(payload)))).toEqual(payload);
		}
	});

	test("rejects a final character carrying bits that no byte holds", () => {
		expect(unwrap(Base64Url.decode("aA"))).toEqual(new Uint8Array([0x68]));
		expect(isFailure(Base64Url.decode("aB"))).toBe(true);

		expect(unwrap(Base64Url.decode("aGk"))).toEqual(new Uint8Array([0x68, 0x69]));
		expect(isFailure(Base64Url.decode("aGl"))).toBe(true);
	});
});

describe("Base64", () => {
	test("encodes with padding and only with standard characters", () => {
		let encoded = Base64.encode(new Uint8Array([251, 255, 190, 255]));

		expect(encoded).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
		expect(encoded.length % 4).toBe(0);
	});

	test("uses the standard alphabet where base64url uses - and _", () => {
		expect(Base64.encode(new Uint8Array([251, 255]))).toBe("+/8=");
	});

	test("pads every input length up to a multiple of four characters", () => {
		expect(Base64.encode("h")).toBe("aA==");
		expect(Base64.encode("hi")).toBe("aGk=");
		expect(Base64.encode("hey")).toBe("aGV5");
	});

	test("matches the credentials of the RFC 7617 example", () => {
		expect(Base64.encode("Aladdin:open sesame")).toBe("QWxhZGRpbjpvcGVuIHNlc2FtZQ==");
	});

	test("encodes the RFC 7617 UTF-8 example", () => {
		expect(Base64.encode("test:123£")).toBe("dGVzdDoxMjPCow==");
	});

	test("round-trips arbitrary bytes", () => {
		let bytes = new Uint8Array(256);
		for (let index = 0; index < bytes.length; index++) bytes[index] = index;

		expect(unwrap(Base64.decode(Base64.encode(bytes)))).toEqual(bytes);
	});

	test("round-trips text through UTF-8", () => {
		let encoded = Base64.encode("héllo 🌍");
		expect(new TextDecoder().decode(unwrap(Base64.decode(encoded)))).toBe("héllo 🌍");
	});

	test("round-trips the empty value", () => {
		expect(Base64.encode(new Uint8Array())).toBe("");
		expect(unwrap(Base64.decode(""))).toEqual(new Uint8Array());
	});

	test("decodes the standard alphabet back to its bytes", () => {
		expect(unwrap(Base64.decode("+/8="))).toEqual(new Uint8Array([251, 255]));
	});

	test("rejects the base64url alphabet", () => {
		let result = Base64.decode("-_8=");
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(InvalidEncodingError);
	});

	test("rejects a length that cannot hold whole bytes", () => {
		expect(isFailure(Base64.decode("a"))).toBe(true);
		expect(isFailure(Base64.decode("aGk"))).toBe(true);
		expect(isFailure(Base64.decode("aA="))).toBe(true);
	});

	test("rejects characters outside the alphabet", () => {
		expect(isSuccess(Base64.decode("abc$"))).toBe(false);
	});

	test("keeps the offending input out of the error message", () => {
		let result = Base64.decode("secret-ish");
		if (!isFailure(result)) throw new Error("expected a failure");
		expect(result.error.message).not.toContain("secret");
	});

	test("encodes the RFC 4648 §10 vectors", () => {
		expect(Base64.encode("")).toBe("");
		expect(Base64.encode("f")).toBe("Zg==");
		expect(Base64.encode("fo")).toBe("Zm8=");
		expect(Base64.encode("foo")).toBe("Zm9v");
		expect(Base64.encode("foob")).toBe("Zm9vYg==");
		expect(Base64.encode("fooba")).toBe("Zm9vYmE=");
		expect(Base64.encode("foobar")).toBe("Zm9vYmFy");
	});

	test("encodes a length of every remainder, one, two, and zero bytes past a group", () => {
		let bytes = new Uint8Array([0, 1, 2, 3, 4, 5]);

		expect(Base64.encode(bytes.subarray(0, 0))).toBe("");
		expect(Base64.encode(bytes.subarray(0, 1))).toBe("AA==");
		expect(Base64.encode(bytes.subarray(0, 2))).toBe("AAE=");
		expect(Base64.encode(bytes.subarray(0, 3))).toBe("AAEC");
		expect(Base64.encode(bytes.subarray(0, 4))).toBe("AAECAw==");
		expect(Base64.encode(bytes.subarray(0, 5))).toBe("AAECAwQ=");
		expect(Base64.encode(bytes.subarray(0, 6))).toBe("AAECAwQF");
	});

	test("round-trips a length of every remainder", () => {
		let bytes = new Uint8Array([9, 8, 7, 6, 5, 4, 3]);

		for (let length = 0; length <= bytes.length; length++) {
			let payload = bytes.slice(0, length);
			expect(unwrap(Base64.decode(Base64.encode(payload)))).toEqual(payload);
		}
	});

	test("rejects a final character carrying bits that no byte holds", () => {
		expect(unwrap(Base64.decode("aA=="))).toEqual(new Uint8Array([0x68]));
		expect(isFailure(Base64.decode("aB=="))).toBe(true);

		expect(unwrap(Base64.decode("aGk="))).toEqual(new Uint8Array([0x68, 0x69]));
		expect(isFailure(Base64.decode("aGl="))).toBe(true);
	});
});

describe("the base64 alphabets together", () => {
	test("round-trips all 256 byte values, each as its own payload", () => {
		for (let value = 0; value < 256; value++) {
			let payload = new Uint8Array([value]);

			expect(unwrap(Base64.decode(Base64.encode(payload)))).toEqual(payload);
			expect(unwrap(Base64Url.decode(Base64Url.encode(payload)))).toEqual(payload);
		}
	});

	test("encodes and round-trips a 2 MB payload without overflowing the call stack", () => {
		let bytes = new Uint8Array(2 * 1024 * 1024 + 1);
		for (let index = 0; index < bytes.length; index++) bytes[index] = (index * 31) % 256;

		let padded = Base64.encode(bytes);
		expect(padded.length).toBe(Math.ceil(bytes.length / 3) * 4);

		let fromPadded = unwrap(Base64.decode(padded));
		expect(fromPadded.length).toBe(bytes.length);
		expect(fromPadded.every((byte, index) => byte === bytes[index])).toBe(true);

		let unpadded = Base64Url.encode(bytes);
		expect(unpadded).not.toContain("=");

		let fromUnpadded = unwrap(Base64Url.decode(unpadded));
		expect(fromUnpadded.length).toBe(bytes.length);
		expect(fromUnpadded.every((byte, index) => byte === bytes[index])).toBe(true);
	});
});
