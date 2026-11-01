/**
 * Tests for the URL helpers a list's filter, sort and view controls link and submit through:
 * each drops pagination, keeps unrelated parameters in order, and accepts absolute or relative URLs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	carriedParams,
	clearFiltersHref,
	paramValues,
	removeFilterHref,
	setParamHref,
} from "./search-params.js";

describe(removeFilterHref.name, () => {
	test("drops every value of a parameter and the page", () => {
		expect(removeFilterHref("/monitors?status=down&status=up&tag=api&page=3", "status")).toBe(
			"/monitors?tag=api",
		);
	});

	test("drops one value when given", () => {
		expect(removeFilterHref("https://app.com/m?status=down&status=up", "status", "down")).toBe(
			"/m?status=up",
		);
	});

	test("returns the bare path once nothing is left", () => {
		expect(removeFilterHref("/monitors?status=down#row-4", "status")).toBe("/monitors");
	});
});

describe(clearFiltersHref.name, () => {
	test("keeps the tab and sort while dropping every filter", () => {
		expect(
			clearFiltersHref("/issues?state=open&label=bug&label=ui&q=crash&sort=new&cursor=x", [
				"label",
				"q",
			]),
		).toBe("/issues?state=open&sort=new");
	});
});

describe(setParamHref.name, () => {
	test("replaces a value and removes it for null", () => {
		expect(setParamHref("/m?sort=a&page=2&status=down", "sort", "b")).toBe("/m?sort=b&status=down");
		expect(setParamHref("/m?sort=a", "sort", null)).toBe("/m");
	});
});

describe(carriedParams.name, () => {
	test("returns the pairs a form's own controls do not write", () => {
		expect(carriedParams("/m?state=open&label=a&label=b&page=2&view=grid", ["label"])).toEqual([
			["state", "open"],
			["view", "grid"],
		]);
	});
});

describe(paramValues.name, () => {
	test("reads repeated values and skips empty ones", () => {
		expect(paramValues("/m?status=down&status=&status=up", "status")).toEqual(["down", "up"]);
	});
});
