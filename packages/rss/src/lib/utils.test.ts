import { describe, expect, test } from "bun:test";

import {
	collapseArray,
	getChildElements,
	getElementText,
	getGuidValue,
	isEmptyRecord,
	normalizeArray,
	normalizeStringArray,
	parseOptionalNumber,
} from "./utils";

describe("rss utils", () => {
	test("reads child elements and text content", () => {
		let element = {
			name: "item",
			attributes: {},
			children: [
				"ignored",
				{ name: "title", attributes: {}, children: ["Hello"] },
				{ name: "link", attributes: {}, children: ["https://example.com"] },
			],
		};

		expect(getChildElements(element)).toEqual([
			{ name: "title", attributes: {}, children: ["Hello"] },
			{ name: "link", attributes: {}, children: ["https://example.com"] },
		]);
		expect(getElementText({ name: "description", attributes: {}, children: ["a", "b"] })).toBe(
			"ab",
		);
	});

	test("parses optional numbers", () => {
		expect(parseOptionalNumber("42")).toBe(42);
		expect(Number.isNaN(parseOptionalNumber("nope"))).toBe(true);
	});

	test("normalizes arrays and strings", () => {
		expect(normalizeArray()).toEqual([]);
		expect(normalizeArray("one")).toEqual(["one"]);
		expect(normalizeArray(["one", "two"])).toEqual(["one", "two"]);
		expect(normalizeStringArray("one")).toEqual(["one"]);
		expect(collapseArray(["one"])).toBe("one");
		expect(collapseArray(["one", "two"])).toEqual(["one", "two"]);
	});

	test("reads guid values and empty records", () => {
		expect(getGuidValue({ title: "Post", guid: "plain-guid" })).toBe("plain-guid");
		expect(
			getGuidValue({ title: "Post", guid: { value: "structured-guid", isPermaLink: false } }),
		).toBe("structured-guid");
		expect(isEmptyRecord()).toBe(true);
		expect(isEmptyRecord({})).toBe(true);
		expect(isEmptyRecord({ key: "value" })).toBe(false);
	});
});
