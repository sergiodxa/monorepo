/**
 * Checks jCard reading against the shapes registries send: a populated card, a redacted
 * empty value, and malformed cards that must read as absent rather than fail a lookup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { jCardText } from "./document.js";

describe("jCardText", () => {
	test("reads the first non-empty text value of a property", () => {
		let card = [
			"vcard",
			[
				["version", {}, "text", "4.0"],
				["email", {}, "text", ""],
				["email", { type: "work" }, "text", "abuse@registrar.com"],
			],
		];
		expect(jCardText(card, "email")).toBe("abuse@registrar.com");
	});

	test("reads a redacted or missing property as null", () => {
		expect(jCardText(["vcard", [["fn", {}, "text", " "]]], "fn")).toBeNull();
		expect(jCardText(["vcard", [["version", {}, "text", "4.0"]]], "fn")).toBeNull();
	});

	test.each([undefined, null, "vcard", ["vcard"], ["card", []], ["vcard", [null, ["fn"]]]])(
		"reads a malformed card %j as null",
		(card) => {
			expect(jCardText(card, "fn")).toBeNull();
		},
	);
});
