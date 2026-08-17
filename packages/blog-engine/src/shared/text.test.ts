import { describe, expect, test } from "vitest";

import { asText, entryText, fieldText } from "./text";

describe("entryText", () => {
	test("returns the submitted text", () => {
		expect(entryText("hello")).toBe("hello");
		expect(entryText("")).toBe("");
	});

	test("falls back for a missing entry", () => {
		expect(entryText(null)).toBe("");
		expect(entryText(null, "en")).toBe("en");
	});

	test("falls back for a file entry instead of stringifying it", () => {
		let file = new File(["body"], "note.txt", { type: "text/plain" });
		expect(entryText(file)).toBe("");
		expect(entryText(file, "en")).toBe("en");
	});
});

describe("fieldText", () => {
	test("reads a text field and falls back when absent", () => {
		let formData = new FormData();
		formData.set("name", "Notes");
		expect(fieldText(formData, "name")).toBe("Notes");
		expect(fieldText(formData, "missing")).toBe("");
		expect(fieldText(formData, "missing", "[]")).toBe("[]");
	});

	test("a file upload never reaches a text field as [object File]", () => {
		let formData = new FormData();
		formData.set("name", new File(["body"], "note.txt", { type: "text/plain" }));
		expect(fieldText(formData, "name")).toBe("");
	});
});

describe("asText", () => {
	test("passes strings through and stringifies other primitives", () => {
		expect(asText("hi")).toBe("hi");
		expect(asText(42)).toBe("42");
		expect(asText(true)).toBe("true");
		expect(asText(10n)).toBe("10");
	});

	test("uses the fallback for null and undefined", () => {
		expect(asText(null)).toBe("");
		expect(asText(undefined, "-")).toBe("-");
	});

	test("serializes structured values as JSON instead of [object Object]", () => {
		expect(asText({ a: 1 })).toBe('{"a":1}');
		expect(asText(["a", "b"])).toBe('["a","b"]');
	});

	test("falls back for values JSON cannot encode", () => {
		expect(asText(Symbol("x"), "-")).toBe("-");
		expect(asText(() => "x", "-")).toBe("-");
	});
});
