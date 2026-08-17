/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { COMPOSITE_FILTER } from "../internal/filter";
import { declarations } from "../internal/serialize";

import { grayscale } from "./grayscale";

describe("grayscale", () => {
	test("no-arg defaults to a full conversion", async () => {
		expect(await declarations(grayscale())).toEqual([
			"--ui-filter-grayscale: 1",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});

	test("an explicit partial amount", async () => {
		expect(await declarations(grayscale(0.5))).toEqual([
			"--ui-filter-grayscale: 0.5",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});

	test("an explicit string amount passes through unchanged", async () => {
		expect(await declarations(grayscale("60%"))).toEqual([
			"--ui-filter-grayscale: 60%",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});
});
