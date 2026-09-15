/**
 * Tests the readers the parser leans on, which decide what a document that typed
 * a field the wrong way contributes to the feed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	extensionsOf,
	isExtensionKey,
	isRecord,
	readBoolean,
	readId,
	readNumber,
	readString,
	readStringArray,
} from "./utils.js";

describe("isRecord", () => {
	test("accepts a plain object and refuses everything else", () => {
		expect(isRecord({})).toBe(true);
		expect(isRecord([])).toBe(false);
		expect(isRecord(null)).toBe(false);
		expect(isRecord("feed")).toBe(false);
	});
});

describe("isExtensionKey", () => {
	test("accepts an underscore followed by a letter", () => {
		expect(isExtensionKey("_blue_shed")).toBe(true);
		expect(isExtensionKey("_A")).toBe(true);
	});

	test("refuses a defined field and an underscore followed by anything else", () => {
		expect(isExtensionKey("title")).toBe(false);
		expect(isExtensionKey("_")).toBe(false);
		expect(isExtensionKey("__proto__")).toBe(false);
		expect(isExtensionKey("_1")).toBe(false);
	});
});

describe("extensionsOf", () => {
	test("collects the custom objects in document order, keeping their names", () => {
		let entries = extensionsOf({
			title: "Feed",
			_blue_shed: { about: "https://example.com" },
			_other: 1,
		});

		expect(entries).toEqual([
			["_blue_shed", { about: "https://example.com" }],
			["_other", 1],
		]);
	});
});

describe("readString", () => {
	test("reads a non-empty string and refuses anything else", () => {
		expect(readString("value")).toBe("value");
		expect(readString("")).toBeUndefined();
		expect(readString(null)).toBeUndefined();
		expect(readString(7)).toBeUndefined();
	});
});

describe("readNumber", () => {
	test("reads a finite number, including the numeric string a publisher may write", () => {
		expect(readNumber(42)).toBe(42);
		expect(readNumber("42")).toBe(42);
		expect(readNumber(Number.POSITIVE_INFINITY)).toBeUndefined();
		expect(readNumber(" ")).toBeUndefined();
		expect(readNumber("forty two")).toBeUndefined();
	});
});

describe("readBoolean", () => {
	test("reads a boolean and refuses a value that merely looks like one", () => {
		expect(readBoolean(true)).toBe(true);
		expect(readBoolean(false)).toBe(false);
		expect(readBoolean("true")).toBeUndefined();
	});
});

describe("readStringArray", () => {
	test("keeps the usable entries and reports nothing for a list holding none", () => {
		expect(readStringArray(["one", "", 2, "three"])).toEqual(["one", "three"]);
		expect(readStringArray([])).toBeUndefined();
		expect(readStringArray("one")).toBeUndefined();
	});
});

describe("readId", () => {
	test("coerces the number a publisher may write, as JSON Feed instructs", () => {
		expect(readId(2347259)).toBe("2347259");
		expect(readId("2347259")).toBe("2347259");
		expect(readId("")).toBeUndefined();
		expect(readId(null)).toBeUndefined();
	});
});
