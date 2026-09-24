/**
 * Covers reading TXT RDATA in presentation format into its character-strings: quoting,
 * the three escape forms of RFC 1035, and multi-byte text written as decimal escapes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { readCharacterStrings } from "./character-strings.js";

describe("readCharacterStrings", () => {
	test("splits quoted strings, keeping spaces inside them", () => {
		expect(unwrap(readCharacterStrings('"v=DKIM1; k=rsa; p=AAA" "BBB"'))).toEqual([
			"v=DKIM1; k=rsa; p=AAA",
			"BBB",
		]);
	});

	test("unescapes quotes and backslashes", () => {
		expect(unwrap(readCharacterStrings('"say \\"hi\\"" "a\\\\b"'))).toEqual(['say "hi"', "a\\b"]);
	});

	test("decodes \\DDD escapes as bytes, so UTF-8 written that way comes back as text", () => {
		expect(unwrap(readCharacterStrings('"caf\\195\\169 \\059"'))).toEqual(["café ;"]);
	});

	test("keeps literal non-ASCII text", () => {
		expect(unwrap(readCharacterStrings('"café"'))).toEqual(["café"]);
	});

	test("reads bare words as separate strings", () => {
		expect(unwrap(readCharacterStrings("v=spf1 -all"))).toEqual(["v=spf1", "-all"]);
	});

	test("keeps an empty quoted string", () => {
		expect(unwrap(readCharacterStrings('""'))).toEqual([""]);
	});

	test("fails on an unterminated quote", () => {
		expect(isFailure(readCharacterStrings('"open'))).toBe(true);
	});

	test("fails on a decimal escape above 255", () => {
		expect(isFailure(readCharacterStrings('"\\300"'))).toBe(true);
	});
});
