/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { COMPOSITE_BACKDROP_FILTER } from "../internal/backdrop-filter.js";
import { compose } from "../internal/descriptor.js";
import { COMPOSITE_FILTER } from "../internal/filter.js";
import { declarations } from "../internal/serialize.js";

import { backdropSaturate } from "./backdrop-saturate.js";
import { saturate } from "./saturate.js";

describe("saturate", () => {
	test("no-arg defaults to 1.5", async () => {
		expect(await declarations(saturate())).toEqual([
			"--ui-filter-saturate: 1.5",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});

	test("an explicit numeric factor", async () => {
		expect(await declarations(saturate(0))).toEqual([
			"--ui-filter-saturate: 0",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});

	test("an explicit string factor passes through unchanged", async () => {
		expect(await declarations(saturate("150%"))).toEqual([
			"--ui-filter-saturate: 150%",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});

	test("does not collide with backdropSaturate, which writes a different variable and property", async () => {
		let merged = compose([saturate(1.5), backdropSaturate(1.4)], (styles) => styles);

		expect(await declarations(merged)).toEqual([
			"--ui-filter-saturate: 1.5",
			`filter: ${COMPOSITE_FILTER}`,
			"--ui-backdrop-saturate: 1.4",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});
});
