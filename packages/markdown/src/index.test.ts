/**
 * Tests for the package root, checking that plain-text extraction is reachable
 * from the root entrypoint and behaves the same there as at its own subpath, so
 * the documented import path cannot drift from the implementation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { toPlainText } from "./index";

describe("toPlainText", () => {
	test("is reachable from the package root", () => {
		expect(typeof toPlainText).toBe("function");
	});

	test("extracts prose from a document with frontmatter", () => {
		let markdown = [
			"---",
			"title: Hello World",
			"---",
			"",
			"# Hello World",
			"",
			"A [linked](https://example.com) paragraph with `code`.",
			"",
			"```ts",
			"let ignored = true;",
			"```",
		].join("\n");

		expect(toPlainText(markdown)).toBe("Hello World\n\nA linked paragraph with code.");
	});

	test("forwards its options", () => {
		let markdown = ["Text.", "", "```ts", "let kept = true;", "```"].join("\n");

		expect(toPlainText(markdown, { fences: true })).toBe("Text.\n\nlet kept = true;");
	});
});
