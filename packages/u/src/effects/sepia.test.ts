/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { COMPOSITE_FILTER } from "../internal/filter.js";
import { declarations } from "../internal/serialize.js";

import { sepia } from "./sepia.js";

describe("sepia", () => {
	test("no-arg defaults to a full conversion", async () => {
		expect(await declarations(sepia())).toEqual([
			"--ui-filter-sepia: 1",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});

	test("an explicit partial amount", async () => {
		expect(await declarations(sepia(0.4))).toEqual([
			"--ui-filter-sepia: 0.4",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});

	test("an explicit string amount passes through unchanged", async () => {
		expect(await declarations(sepia("40%"))).toEqual([
			"--ui-filter-sepia: 40%",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});
});
