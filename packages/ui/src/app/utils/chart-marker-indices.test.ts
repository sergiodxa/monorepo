/**
 * Unit tests for {@link "./chart-marker-indices"}: every assertion checks
 * known points, domains, and marker counts against known index results as
 * plain function calls.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { computeMarkerIndices } from "./chart-marker-indices.js";

describe(computeMarkerIndices.name, () => {
	test("returns no markers for an empty series", () => {
		expect(computeMarkerIndices([], [0, 10], 6)).toEqual([]);
	});

	test("snaps evenly spread nice values onto the nearest actual point", () => {
		let points = Array.from({ length: 11 }, (_, x) => ({ x }));

		expect(computeMarkerIndices(points, [0, 10], 6)).toEqual([0, 2, 4, 6, 8, 10]);
	});

	test("collapses duplicate snaps onto a sparse series below markerCount", () => {
		let points = [{ x: 0 }, { x: 10 }];

		expect(computeMarkerIndices(points, [0, 10], 6)).toEqual([0, 1]);
	});

	test("favors the earlier point on an exact tie", () => {
		let points = [{ x: 5 }, { x: 5 }];

		expect(computeMarkerIndices(points, [5, 5], 3)).toEqual([0]);
	});
});
