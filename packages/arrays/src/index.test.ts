/**
 * Tests hasAny, hasMany, isEmpty, first, last, unique, toArray, and skip
 * across empty, single, and multi-element arrays.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { first, hasAny, hasMany, isEmpty, last, skip, toArray, unique } from "./index";

describe("hasAny", () => {
	test("returns true for non-empty array", () => {
		expect(hasAny([1])).toBe(true);
		expect(hasAny([1, 2, 3])).toBe(true);
	});

	test("returns false for empty array", () => {
		expect(hasAny([])).toBe(false);
	});
});

describe("hasMany", () => {
	test("returns true for arrays with more than one element", () => {
		expect(hasMany([1, 2])).toBe(true);
		expect(hasMany([1, 2, 3])).toBe(true);
	});

	test("returns false for arrays with one or zero elements", () => {
		expect(hasMany([])).toBe(false);
		expect(hasMany([1])).toBe(false);
	});
});

describe("isEmpty", () => {
	test("returns true for empty array", () => {
		expect(isEmpty([])).toBe(true);
	});

	test("returns false for non-empty array", () => {
		expect(isEmpty([1])).toBe(false);
		expect(isEmpty([1, 2, 3])).toBe(false);
	});
});

describe("first", () => {
	test("returns first element by default", () => {
		expect(first([1, 2, 3])).toEqual([1]);
	});

	test("returns first n elements when limit specified", () => {
		expect(first([1, 2, 3, 4, 5], 3)).toEqual([1, 2, 3]);
	});

	test("returns empty array for empty input", () => {
		expect(first([])).toEqual([]);
	});

	test("returns all elements if limit exceeds length", () => {
		expect(first([1, 2], 5)).toEqual([1, 2]);
	});
});

describe("last", () => {
	test("returns last element by default", () => {
		expect(last([1, 2, 3])).toEqual([3]);
	});

	test("returns last n elements when limit specified", () => {
		expect(last([1, 2, 3, 4, 5], 3)).toEqual([3, 4, 5]);
	});

	test("returns empty array for empty input", () => {
		expect(last([])).toEqual([]);
	});

	test("returns all elements if limit exceeds length", () => {
		expect(last([1, 2], 5)).toEqual([1, 2]);
	});
});

describe("unique", () => {
	test("removes duplicate primitives", () => {
		expect(unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
	});

	test("removes duplicate strings", () => {
		expect(unique(["a", "b", "a", "c", "b"])).toEqual(["a", "b", "c"]);
	});

	test("returns empty array for empty input", () => {
		expect(unique([])).toEqual([]);
	});

	test("preserves order of first occurrence", () => {
		expect(unique([3, 1, 2, 1, 3])).toEqual([3, 1, 2]);
	});
});

describe("toArray", () => {
	test("wraps non-array value in array", () => {
		expect(toArray(1)).toEqual([1]);
		expect(toArray("hello")).toEqual(["hello"]);
		expect(toArray(null)).toEqual([null]);
	});

	test("returns array as-is if already an array", () => {
		expect(toArray([1, 2, 3])).toEqual([1, 2, 3]);
		expect(toArray([])).toEqual([]);
	});
});

describe("skip", () => {
	test("skips first n items", () => {
		expect(skip([1, 2, 3, 4, 5], 2)).toEqual([3, 4, 5]);
	});

	test("returns empty array if skipping all elements", () => {
		expect(skip([1, 2, 3], 3)).toEqual([]);
	});

	test("returns empty array if skip exceeds length", () => {
		expect(skip([1, 2], 5)).toEqual([]);
	});

	test("returns all elements if skip is 0", () => {
		expect(skip([1, 2, 3], 0)).toEqual([1, 2, 3]);
	});
});
