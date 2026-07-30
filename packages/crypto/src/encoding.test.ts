/**
 * Tests for the hex and base64url codecs.
 *
 * Round-trip cases pin the canonical output shape (lowercase hex, unpadded
 * base64url) and the rejection cases pin that a malformed string never decodes
 * partially, since a partial decode would let a truncated signature compare equal.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { isFailure, isSuccess, unwrap } from "@pkg/result";

import { Base64Url, Hex } from "./encoding";
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
});
