/**
 * Checks domain typo suggestions for common mail providers: transpositions, a missing or
 * extra letter, a mistyped top-level domain, and the addresses that must get no
 * suggestion because they are already a provider or too far from one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { parseEmailAddress } from "./parse.js";
import { suggestDomain } from "./typo.js";

/** The suggested address for `input`, or `null` when there is none. */
function suggestionFor(input: string): string | null {
	return suggestDomain(unwrap(parseEmailAddress(input)))?.address ?? null;
}

describe("suggestDomain", () => {
	test.each([
		["Jane@gmial.com", "Jane@gmail.com"],
		["jane@gmal.com", "jane@gmail.com"],
		["jane@gmaill.com", "jane@gmail.com"],
		["jane@gmail.con", "jane@gmail.com"],
		["jane@hotmial.con", "jane@hotmail.com"],
		["jane@yaho.com", "jane@yahoo.com"],
		["jane@outlok.com", "jane@outlook.com"],
		["jane@icloud.co", "jane@icloud.com"],
	])("suggests %s → %s", (input, expected) => {
		expect(suggestionFor(input)).toBe(expected);
	});

	test("returns every form of the suggested address", () => {
		expect(suggestDomain(unwrap(parseEmailAddress("Jane@gmial.com")))).toEqual({
			address: "Jane@gmail.com",
			canonical: "jane@gmail.com",
			localPart: "Jane",
			domain: "gmail.com",
		});
	});

	test.each([
		"jane@gmail.com",
		"jane@mail.com",
		"jane@example.com",
		"jane@company.io",
		"jane@gnail.example",
	])("suggests nothing for %s", (input) => {
		expect(suggestionFor(input)).toBeNull();
	});
});
