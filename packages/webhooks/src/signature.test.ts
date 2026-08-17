/**
 * Tests for the signature scheme primitives.
 *
 * The signed content and the header format are what interoperability rests on, so
 * both are pinned literally, and parsing is checked to skip values it cannot use
 * while still failing a header with nothing usable left.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@pkg/result";
import { describe, expect, test } from "vitest";

import { MalformedSignatureError } from "./errors";
import { encodeBase64 } from "./lib/base64";
import { decodeSecret } from "./secret";
import { computeSignature, formatSignature, parseSignatures, signedContent } from "./signature";

/** Specification example signature, used as a value that parses. */
const EXAMPLE = "v1,K5oZfzN95Z9UVu1EsfQmfVNQhnkZ2pj9o9NDN/H/pI4=";

describe("signedContent", () => {
	test("joins the id, the timestamp, and the raw body with dots", () => {
		expect(signedContent("msg_1", 1614265330, '{"test": 1}')).toBe('msg_1.1614265330.{"test": 1}');
	});

	test("keeps the body byte for byte, including whitespace", () => {
		expect(signedContent("msg_1", 1, '{ "a":  1 }')).toBe('msg_1.1.{ "a":  1 }');
	});
});

describe("formatSignature", () => {
	test("prefixes the symmetric scheme and encodes as standard base64", () => {
		expect(formatSignature(new Uint8Array([251, 255]))).toBe("v1,+/8=");
	});
});

describe("computeSignature", () => {
	test("produces a 32-byte SHA-256 MAC", async () => {
		let secret = unwrap(decodeSecret("MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw"));

		expect(unwrap(await computeSignature(secret, "content")).length).toBe(32);
	});

	test("changes when the content changes", async () => {
		let secret = unwrap(decodeSecret("MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw"));
		let first = unwrap(await computeSignature(secret, "content"));
		let second = unwrap(await computeSignature(secret, "content!"));

		expect(encodeBase64(first)).not.toBe(encodeBase64(second));
	});
});

describe("parseSignatures", () => {
	test("parses a single v1 value", () => {
		expect(unwrap(parseSignatures(EXAMPLE)).length).toBe(1);
	});

	test("parses every v1 value in a space-separated header, in order", () => {
		let first = formatSignature(new Uint8Array([1, 2]));
		let second = formatSignature(new Uint8Array([3, 4]));
		let candidates = unwrap(parseSignatures(`${first} ${second}`));

		expect(candidates.length).toBe(2);
		expect([...candidates[0]!]).toEqual([1, 2]);
		expect([...candidates[1]!]).toEqual([3, 4]);
	});

	test("skips values from other schemes", () => {
		let candidates = unwrap(parseSignatures(`v1a,AAAA ${EXAMPLE}`));

		expect(candidates.length).toBe(1);
	});

	test("skips a value that does not decode but keeps a usable sibling", () => {
		expect(unwrap(parseSignatures(`v1,!!!! ${EXAMPLE}`)).length).toBe(1);
	});

	test("skips a value whose scheme has no signature after it", () => {
		expect(unwrap(parseSignatures(`v1, ${EXAMPLE}`)).length).toBe(1);
	});

	test("fails when no value uses the v1 scheme", () => {
		let result = parseSignatures("v1a,AAAA");

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(MalformedSignatureError);
	});

	test("fails when the header carries no scheme separator", () => {
		expect(isFailure(parseSignatures("K5oZfzN95Z9UVu1EsfQmfVNQhnkZ2pj9o9NDN/H/pI4="))).toBe(true);
	});

	test("fails on an empty header", () => {
		expect(isFailure(parseSignatures(""))).toBe(true);
	});

	test("keeps the header out of the error message", () => {
		let result = parseSignatures("v1a,AAAA");

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).not.toContain("AAAA");
	});
});
