/**
 * Tests for the facet set: parsing and writing URL filters, narrowing records, disjunctive
 * counts checked against a brute-force recount, range buckets and the chip helpers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { ValidationError } from "@sdxc/validate";
import { describe, expect, expectTypeOf, test } from "vitest";

import type { NumberRange } from "./index.js";

import { createFacets } from "./index.js";

interface Poster {
	id: string;
	style: string;
	colors: string[];
	price: number | null;
	stock: number;
}

const POSTERS: Poster[] = [
	{ id: "a", style: "botanical", colors: ["green", "ochre"], price: 1800, stock: 4 },
	{ id: "b", style: "botanical", colors: ["green"], price: 3200, stock: 0 },
	{ id: "c", style: "geometric", colors: ["red", "ochre"], price: 2500, stock: 2 },
	{ id: "d", style: "geometric", colors: ["blue"], price: 6400, stock: 1 },
	{ id: "e", style: "travel", colors: ["blue", "ochre", "ochre"], price: 4900, stock: 0 },
	{ id: "f", style: "travel", colors: [], price: null, stock: 3 },
];

const FACETS = createFacets<Poster>()
	.terms("style", (poster) => poster.style, {
		values: ["geometric", "botanical", "travel", "type"],
	})
	.terms("color", (poster) => poster.colors)
	.range("price", (poster) => poster.price, { buckets: [0, 2500, 5000] })
	.toggle("inStock", (poster) => poster.stock > 0, { param: "in_stock" });

/** Parses a query string and fails the test on a parse failure. */
function parsed(query: string) {
	let result = FACETS.parse(new URLSearchParams(query));
	if (isFailure(result)) throw result.error;
	return result.data;
}

/** Recounts one facet's options by filtering every record against every other facet. */
function bruteForceTermCounts(filters: ReturnType<typeof FACETS.empty>, facet: "style" | "color") {
	let others = { ...filters, [facet]: [] };
	let tally = new Map<string, number>();
	for (let poster of FACETS.apply(POSTERS, others).items) {
		let values = facet === "style" ? [poster.style] : [...new Set(poster.colors)];
		for (let value of values) tally.set(value, (tally.get(value) ?? 0) + 1);
	}
	return tally;
}

describe("parse", () => {
	test("reads repeated terms, both range ends and a checkbox toggle", () => {
		let filters = parsed(
			"style=travel&color=ochre&color=blue&price_min=2500&price_max=5000&in_stock=on",
		);
		expect(filters).toEqual({
			style: ["travel"],
			color: ["ochre", "blue"],
			price: { min: 2500, max: 5000 },
			inStock: true,
		});
	});

	test("treats blank and missing parameters as no filter", () => {
		expect(parsed("color=&price_min=%20&in_stock=")).toEqual(FACETS.empty());
	});

	test("deduplicates a term repeated in the URL", () => {
		expect(parsed("color=ochre&color=ochre").color).toEqual(["ochre"]);
	});

	test("reports every malformed parameter at once, each under its own name", () => {
		let result = FACETS.parse(
			new URLSearchParams("style=vaporwave&price_min=cheap&in_stock=maybe"),
		);
		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error).toBeInstanceOf(ValidationError);
		expect(result.error.issues.map((issue) => issue.path)).toEqual([
			["style"],
			["price_min"],
			["in_stock"],
		]);
	});

	test("rejects a range whose lower end is not below its upper end", () => {
		let result = FACETS.parse(new URLSearchParams("price_min=5000&price_max=2500"));
		expect(isFailure(result) && result.error.issues[0]?.path).toEqual(["price_max"]);
	});

	test("rejects more values than the facet's limit", () => {
		let small = createFacets<Poster>().terms("color", (poster) => poster.colors, { limit: 2 });
		expect(isFailure(small.parse(new URLSearchParams("color=a&color=b&color=c")))).toBe(true);
	});

	test("accepts 0 and false for a toggle that is off", () => {
		expect(parsed("in_stock=0").inStock).toBe(false);
		expect(parsed("in_stock=FALSE").inStock).toBe(false);
	});
});

describe("serialize", () => {
	test("round-trips through parse", () => {
		let filters = parsed("color=blue&color=red&style=travel&price_max=2500&in_stock=1");
		expect(parsed(FACETS.serialize(filters).toString())).toEqual(filters);
	});

	test("writes one URL per selection, terms in declared or alphabetical order", () => {
		let filters = { ...FACETS.empty(), style: ["travel", "geometric"], color: ["red", "blue"] };
		expect(FACETS.serialize(filters).toString()).toBe(
			"style=geometric&style=travel&color=blue&color=red",
		);
	});

	test("keeps parameters no facet owns and replaces the ones it does", () => {
		let base = new URLSearchParams("q=fern&color=green&sort=price&in_stock=1");
		let params = FACETS.serialize({ color: ["blue"] }, base);
		expect(params.toString()).toBe("q=fern&sort=price&color=blue");
	});

	test("leaves the base untouched", () => {
		let base = new URLSearchParams("color=green");
		FACETS.serialize({ color: ["blue"] }, base);
		expect(base.toString()).toBe("color=green");
	});
});

describe("apply", () => {
	test("returns every record and full counts with no filters", () => {
		let { items, total, counts } = FACETS.apply(POSTERS);
		expect(items.map((poster) => poster.id)).toEqual(["a", "b", "c", "d", "e", "f"]);
		expect(total).toBe(6);
		expect(counts.style).toEqual([
			{ value: "geometric", count: 2, selected: false },
			{ value: "botanical", count: 2, selected: false },
			{ value: "travel", count: 2, selected: false },
			{ value: "type", count: 0, selected: false },
		]);
		expect(counts.color).toEqual([
			{ value: "ochre", count: 3, selected: false },
			{ value: "blue", count: 2, selected: false },
			{ value: "green", count: 2, selected: false },
			{ value: "red", count: 1, selected: false },
		]);
		expect(counts.inStock).toEqual({ count: 4, selected: false });
	});

	test("matches any chosen value within a facet and every facet across them", () => {
		let { items } = FACETS.apply(POSTERS, parsed("color=blue&color=red&in_stock=1"));
		expect(items.map((poster) => poster.id)).toEqual(["c", "d"]);
	});

	test("counts a facet's options with the other facets applied but not its own", () => {
		let filters = parsed("style=botanical&color=ochre");
		let { items, counts } = FACETS.apply(POSTERS, filters);
		expect(items.map((poster) => poster.id)).toEqual(["a"]);
		expect(counts.style.find((option) => option.value === "geometric")?.count).toBe(1);
		expect(counts.color.find((option) => option.value === "green")).toEqual({
			value: "green",
			count: 2,
			selected: false,
		});
		expect(counts.color.find((option) => option.value === "ochre")?.selected).toBe(true);
	});

	test.each([
		"",
		"style=travel",
		"color=ochre&in_stock=1",
		"style=geometric&style=travel&color=blue&price_max=5000",
		"price_min=2500&in_stock=1",
	])("agrees with a brute-force recount for %j", (query) => {
		let filters = parsed(query);
		let { counts } = FACETS.apply(POSTERS, filters);
		for (let facet of ["style", "color"] as const) {
			let expected = bruteForceTermCounts(filters, facet);
			for (let option of counts[facet]) expect(option.count).toBe(expected.get(option.value) ?? 0);
		}
	});

	test("keeps a chosen value listed at zero so it can be unticked", () => {
		let { counts } = FACETS.apply(POSTERS, parsed("style=geometric&color=green"));
		expect(counts.color.find((option) => option.value === "green")).toEqual({
			value: "green",
			count: 0,
			selected: true,
		});
	});

	test("counts range buckets as half-open intervals and marks the chosen one", () => {
		let { items, counts } = FACETS.apply(POSTERS, parsed("price_min=2500&price_max=5000"));
		expect(items.map((poster) => poster.id)).toEqual(["b", "c", "e"]);
		expect(counts.price).toEqual({
			min: 1800,
			max: 6400,
			buckets: [
				{ min: 0, max: 2500, count: 1, selected: false },
				{ min: 2500, max: 5000, count: 3, selected: true },
				{ min: 5000, max: null, count: 1, selected: false },
			],
		});
	});

	test("keeps a record without a value while the range is open and drops it once set", () => {
		expect(FACETS.apply(POSTERS).items.some((poster) => poster.id === "f")).toBe(true);
		expect(
			FACETS.apply(POSTERS, parsed("price_min=0")).items.some((poster) => poster.id === "f"),
		).toBe(false);
	});

	test("reports open range bounds when no record carries a value", () => {
		let { counts } = FACETS.apply(POSTERS, parsed("style=type"));
		expect(counts.price.min).toBeNull();
		expect(counts.price.max).toBeNull();
	});

	test("counts a toggle over the records the other facets leave", () => {
		let { counts } = FACETS.apply(POSTERS, parsed("style=travel&in_stock=1"));
		expect(counts.inStock).toEqual({ count: 1, selected: true });
	});
});

describe("selection helpers", () => {
	test("toggleTerm adds an unchosen value and removes a chosen one", () => {
		let once = FACETS.toggleTerm(FACETS.empty(), "color", "red");
		expect(once.color).toEqual(["red"]);
		expect(FACETS.toggleTerm(once, "color", "red").color).toEqual([]);
	});

	test("set and clear replace one facet and leave the rest", () => {
		let filters = FACETS.set(parsed("color=red"), "price", { min: 0, max: 2500 });
		expect(filters).toMatchObject({ color: ["red"], price: { min: 0, max: 2500 } });
		expect(FACETS.clear(filters, "color")).toMatchObject({
			color: [],
			price: { min: 0, max: 2500 },
		});
		expect(FACETS.clear(filters)).toEqual(FACETS.empty());
	});

	test("applied lists each filter with the selection that removes it", () => {
		let filters = parsed("color=red&color=blue&price_max=2500&in_stock=1");
		let chips = FACETS.applied(filters);
		expect(chips.map((chip) => [chip.facet, chip.value])).toEqual([
			["color", "blue"],
			["color", "red"],
			["price", { min: null, max: 2500 }],
			["inStock", true],
		]);
		expect(FACETS.serialize(chips[0]?.filters ?? {}).toString()).toBe(
			"color=red&price_max=2500&in_stock=1",
		);
	});

	test("parse succeeds for a set with no facets", () => {
		expect(isSuccess(createFacets<Poster>().parse(new URLSearchParams("q=x")))).toBe(true);
	});
});

describe("types", () => {
	test("filters and counts take each facet's shape", () => {
		let filters = FACETS.empty();
		expectTypeOf(filters.color).toEqualTypeOf<string[]>();
		expectTypeOf(filters.price).toEqualTypeOf<NumberRange>();
		expectTypeOf(filters.inStock).toEqualTypeOf<boolean>();
		expectTypeOf(FACETS.apply(POSTERS).items).toEqualTypeOf<Poster[]>();
		expectTypeOf<Parameters<typeof FACETS.toggleTerm>[1]>().toEqualTypeOf<"style" | "color">();
		let reused = createFacets<Poster>().terms("color", (poster) => poster.style);
		expectTypeOf<Parameters<typeof reused.toggle<"color">>[0]>().toEqualTypeOf<never>();
	});
});
