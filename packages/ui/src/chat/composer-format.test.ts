/**
 * Holds the composer's Markdown edits to their contract: each inline format wraps a selection
 * and toggles off, an empty selection leaves the caret between new markers, code over lines
 * becomes a fence, a link selects its address, and quotes and lists prefix every line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { applyFormat } from "./composer-format.js";

describe("applyFormat inline formats", () => {
	test.each([
		["bold", "hi **there**"],
		["italic", "hi _there_"],
		["strike", "hi ~~there~~"],
		["code", "hi `there`"],
	] as const)("%s wraps the selection and keeps it selected", (action, expected) => {
		let result = applyFormat("hi there", 3, 8, action);

		expect(result.value).toBe(expected);
		expect(result.value.slice(result.start, result.end)).toBe("there");
	});

	test("bold toggles off when the markers sit just outside the selection", () => {
		expect(applyFormat("hi **there**", 5, 10, "bold")).toEqual({
			value: "hi there",
			start: 3,
			end: 8,
		});
	});

	test("bold toggles off when the selection holds its markers", () => {
		expect(applyFormat("hi **there**", 3, 12, "bold")).toEqual({
			value: "hi there",
			start: 3,
			end: 8,
		});
	});

	test("an empty selection writes the markers with the caret between them", () => {
		expect(applyFormat("hi ", 3, 3, "bold")).toEqual({ value: "hi ****", start: 5, end: 5 });
	});

	test("pressing again on an empty pair removes it", () => {
		expect(applyFormat("hi ****", 5, 5, "bold")).toEqual({ value: "hi ", start: 3, end: 3 });
	});

	test("whitespace at the selection's edges stays outside the markers", () => {
		let result = applyFormat("say hello now", 3, 10, "italic");

		expect(result.value).toBe("say _hello_ now");
		expect(result.value.slice(result.start, result.end)).toBe("hello");
	});

	test("a selection running backwards is read in order", () => {
		expect(applyFormat("hi there", 8, 3, "bold").value).toBe("hi **there**");
	});
});

describe("applyFormat code fences", () => {
	test("code over several lines makes a fence on lines of its own", () => {
		let result = applyFormat("see:\nlet a = 1;\nlet b = 2;\ndone", 5, 26, "code");

		expect(result.value).toBe("see:\n```\nlet a = 1;\nlet b = 2;\n```\ndone");
		expect(result.value.slice(result.start, result.end)).toBe("let a = 1;\nlet b = 2;");
	});

	test("a fence starts on a new line when the selection starts mid-line", () => {
		expect(applyFormat("see: a\nb", 5, 8, "code").value).toBe("see: \n```\na\nb\n```");
	});

	test("code on a fenced selection removes the fence", () => {
		let fenced = "```\na\nb\n```";
		let selected = applyFormat("a\nb", 0, 3, "code");

		expect(selected.value).toBe(fenced);
		expect(applyFormat(fenced, selected.start, selected.end, "code")).toEqual({
			value: "a\nb",
			start: 0,
			end: 3,
		});
		expect(applyFormat(fenced, 0, fenced.length, "code").value).toBe("a\nb");
	});
});

describe("applyFormat links", () => {
	test("a link uses the selection as its text and selects the address", () => {
		let result = applyFormat("read the docs", 9, 13, "link");

		expect(result.value).toBe("read the [docs](url)");
		expect(result.value.slice(result.start, result.end)).toBe("url");
	});

	test("an empty selection writes an empty link with its address selected", () => {
		let result = applyFormat("", 0, 0, "link");

		expect(result.value).toBe("[](url)");
		expect(result.value.slice(result.start, result.end)).toBe("url");
	});

	test("a selected link turns back into its text", () => {
		expect(applyFormat("see [docs](https://a.com)", 4, 25, "link")).toEqual({
			value: "see docs",
			start: 4,
			end: 8,
		});
	});
});

describe("applyFormat line prefixes", () => {
	test("quote prefixes every selected line and selects the block", () => {
		let result = applyFormat("one\ntwo\nthree", 2, 6, "quote");

		expect(result.value).toBe("> one\n> two\nthree");
		expect(result.value.slice(result.start, result.end)).toBe("> one\n> two");
	});

	test("list toggles off when every line already carries it", () => {
		expect(applyFormat("- one\n- two", 0, 11, "list")).toEqual({
			value: "one\ntwo",
			start: 0,
			end: 7,
		});
	});

	test("a mix of prefixed and bare lines prefixes the bare ones", () => {
		expect(applyFormat("- one\ntwo", 0, 9, "list").value).toBe("- one\n- two");
	});

	test("a caret prefixes its own line and keeps its place in the text", () => {
		expect(applyFormat("one\ntwo", 5, 5, "list")).toEqual({
			value: "one\n- two",
			start: 7,
			end: 7,
		});
		expect(applyFormat("one\n- two", 7, 7, "list")).toEqual({
			value: "one\ntwo",
			start: 5,
			end: 5,
		});
	});

	test("a selection ending on a newline leaves the next line alone", () => {
		expect(applyFormat("one\ntwo", 0, 4, "quote").value).toBe("> one\ntwo");
	});
});
