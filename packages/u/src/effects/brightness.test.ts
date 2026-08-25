/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { COMPOSITE_FILTER } from "../internal/filter";
import { declarations } from "../internal/serialize";

import { brightness } from "./brightness";

describe("brightness", () => {
	test("no-arg defaults to 1.1", async () => {
		expect(await declarations(brightness())).toEqual([
			"--ui-filter-brightness: 1.1",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});

	test("an explicit numeric factor", async () => {
		expect(await declarations(brightness(0.5))).toEqual([
			"--ui-filter-brightness: 0.5",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});

	test("an explicit string factor passes through unchanged", async () => {
		expect(await declarations(brightness("110%"))).toEqual([
			"--ui-filter-brightness: 110%",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});

	test("the factor carries no unit, so the filter function stays valid", async () => {
		expect(await declarations(brightness(1.1))).toContain("--ui-filter-brightness: 1.1");
	});
});
