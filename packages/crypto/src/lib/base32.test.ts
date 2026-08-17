/**
 * Tests for the internal base32 codec.
 *
 * The RFC 4648 vectors are checked directly because TOTP secrets are typed by hand
 * from this output: an off-by-one in the bit packing would produce a secret that
 * looks plausible and silently never matches an authenticator app.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@pkg/result";
import { describe, expect, test } from "vitest";

import { decode, encode } from "./base32";

/** RFC 4648 test vectors, with the padding this codec omits removed. */
const VECTORS = [
	["", ""],
	["f", "MY"],
	["fo", "MZXQ"],
	["foo", "MZXW6"],
	["foob", "MZXW6YQ"],
	["fooba", "MZXW6YTB"],
	["foobar", "MZXW6YTBOI"],
] as const;

describe("base32", () => {
	test.each(VECTORS)("encodes %p as %p", (text, expected) => {
		expect(encode(new TextEncoder().encode(text))).toBe(expected);
	});

	test.each(VECTORS)("decodes back to %p", (text, encoded) => {
		expect(new TextDecoder().decode(unwrap(decode(encoded)))).toBe(text);
	});

	test("round-trips arbitrary bytes", () => {
		let bytes = new Uint8Array(64);
		for (let index = 0; index < bytes.length; index++) bytes[index] = index * 3;

		expect(unwrap(decode(encode(bytes)))).toEqual(bytes);
	});

	test("accepts lowercase, padding, spaces, and dashes", () => {
		expect(unwrap(decode("mzxw6ytboi"))).toEqual(unwrap(decode("MZXW6YTBOI")));
		expect(unwrap(decode("MZXW6YTBOI======"))).toEqual(unwrap(decode("MZXW6YTBOI")));
		expect(unwrap(decode("MZXW 6YTB OI"))).toEqual(unwrap(decode("MZXW6YTBOI")));
		expect(unwrap(decode("MZXW-6YTB-OI"))).toEqual(unwrap(decode("MZXW6YTBOI")));
	});

	test("fails on characters outside the alphabet", () => {
		expect(isFailure(decode("MZXW6YTB01"))).toBe(true);
		expect(isFailure(decode("not base32!"))).toBe(true);
	});
});
