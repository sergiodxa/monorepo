/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { COMPOSITE_FILTER } from "../internal/filter.js";
import { declarations } from "../internal/serialize.js";

import { contrast } from "./contrast.js";

describe("contrast", () => {
	test("no-arg defaults to 1.25", async () => {
		expect(await declarations(contrast())).toEqual([
			"--ui-filter-contrast: 1.25",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});

	test("an explicit numeric factor", async () => {
		expect(await declarations(contrast(0))).toEqual([
			"--ui-filter-contrast: 0",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});

	test("an explicit string factor passes through unchanged", async () => {
		expect(await declarations(contrast("125%"))).toEqual([
			"--ui-filter-contrast: 125%",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});
});
