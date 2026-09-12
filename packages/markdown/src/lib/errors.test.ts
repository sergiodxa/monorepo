/**
 * Pins what each failure carries once it leaves the parser: the name a log line
 * prints, the position an author opens, the cause a thrown value keeps, and the
 * `Error` inheritance callers branch on before reading any of it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { describe, expect, test } from "vitest";

import type { Markdown } from "../index.js";

import { MarkdownParseError, MarkdownStringifyError, MarkdownWalkError } from "./errors.js";

/** The span a failure on the third line of a document would be given. */
const POSITION: Markdown.Position = {
	start: { line: 3, column: 1, offset: 18 },
	end: { line: 3, column: 8, offset: 25 },
};

/** What a schema reports, which is the shape a caller renders beside the field it names. */
const ISSUES: ReadonlyArray<StandardSchemaV1.Issue> = [
	{ message: "Expected a string", path: ["title"] },
];

describe("MarkdownParseError", () => {
	test("is an error, so a caller may catch it before reading anything else", () => {
		let error = new MarkdownParseError("Unclosed tag <note>");

		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe("MarkdownParseError");
		expect(error.message).toBe("Unclosed tag <note>");
	});

	test("carries the position the document stopped making sense at", () => {
		expect(new MarkdownParseError("Unclosed tag <note>", { position: POSITION }).position).toEqual(
			POSITION,
		);
	});

	test("carries the failure it was raised from", () => {
		let cause = new Error("YAML could not read the block");

		expect(new MarkdownParseError("The frontmatter is unreadable", { cause }).cause).toBe(cause);
	});

	test("carries the issues a schema reported", () => {
		expect(new MarkdownParseError("The frontmatter is invalid", { issues: ISSUES }).issues).toEqual(
			ISSUES,
		);
	});

	test("reports no issues when it was raised without any", () => {
		expect(new MarkdownParseError("Unclosed tag <note>").issues).toEqual([]);
	});

	test("leaves the position undefined when it was raised without one", () => {
		expect(new MarkdownParseError("Unclosed tag <note>").position).toBeUndefined();
	});
});

describe("MarkdownStringifyError", () => {
	test("is an error, so a caller may catch it before reading anything else", () => {
		let error = new MarkdownStringifyError("The frontmatter holds a value YAML cannot write");

		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe("MarkdownStringifyError");
		expect(error.message).toBe("The frontmatter holds a value YAML cannot write");
	});

	test("carries the failure it was raised from", () => {
		let cause = new Error("A function has no YAML form");

		expect(
			new MarkdownStringifyError("The frontmatter holds a value YAML cannot write", { cause })
				.cause,
		).toBe(cause);
	});
});

describe("MarkdownWalkError", () => {
	test("is an error, so a caller may catch it before reading anything else", () => {
		let error = new MarkdownWalkError("The text handler threw");

		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe("MarkdownWalkError");
		expect(error.message).toBe("The text handler threw");
	});

	test("carries the position of the node the visitor was standing on", () => {
		expect(
			new MarkdownWalkError("The text handler threw", { position: POSITION }).position,
		).toEqual(POSITION);
	});

	test("carries the value the handler threw", () => {
		let cause = new Error("Nope");

		expect(new MarkdownWalkError("The text handler threw", { cause }).cause).toBe(cause);
	});

	test("leaves the position undefined when it was raised without one", () => {
		expect(new MarkdownWalkError("The text handler threw").position).toBeUndefined();
	});
});
