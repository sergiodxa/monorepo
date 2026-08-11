/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { COMPOSITE_FILTER } from "../internal/filter";
import { declarations } from "../internal/serialize";

import { filterOpacity } from "./filter-opacity";
import { opacity } from "./opacity";

describe("filterOpacity", () => {
	test("no-arg defaults to 0.5", async () => {
		expect(await declarations(filterOpacity())).toEqual([
			"--ui-filter-opacity: 0.5",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});

	test("an explicit numeric amount in the native 0-1 range", async () => {
		expect(await declarations(filterOpacity(0.25))).toEqual([
			"--ui-filter-opacity: 0.25",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});

	test("a raw percentage string passes through unchanged", async () => {
		expect(await declarations(filterOpacity("25%"))).toEqual([
			"--ui-filter-opacity: 25%",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});

	test("it sets the filter variable, never the opacity property", async () => {
		let result = await declarations(filterOpacity(0.5));

		expect(result.map((line) => line.split(":")[0])).toEqual(["--ui-filter-opacity", "filter"]);
	});

	test("it does not share the 0-100 convention u.opacity() uses", async () => {
		expect(await declarations(opacity(50))).toEqual(["opacity: 0.5"]);
		expect(await declarations(filterOpacity(0.5))).toContain("--ui-filter-opacity: 0.5");
	});
});
