/**
 * Tests how help prints a command's examples: the program goes before the command after the
 * last pipe, so an example fed by another command reads as a shell user types it, and one that
 * already names the program prints as written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { exampleLine } from "./help.js";

describe("exampleLine", () => {
	test("puts the program before an example that starts with its command", () => {
		expect(exampleLine("prog", "hash a.json --json")).toBe("prog hash a.json --json");
	});

	test("puts the program after the last pipe of a fed example", () => {
		expect(exampleLine("prog", "cat a.json | hash --alg sha-512")).toBe(
			"cat a.json | prog hash --alg sha-512",
		);
		expect(exampleLine("prog", "cat a | jq . | hash")).toBe("cat a | jq . | prog hash");
	});

	test("prints an example that already names the program as written", () => {
		expect(exampleLine("prog", "curl -s https://x.com | prog extract")).toBe(
			"curl -s https://x.com | prog extract",
		);
		expect(exampleLine("prog", "prog --version")).toBe("prog --version");
	});
});
