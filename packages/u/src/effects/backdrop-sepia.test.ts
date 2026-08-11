/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { COMPOSITE_BACKDROP_FILTER } from "../internal/backdrop-filter";
import { declarations } from "../internal/serialize";

import { backdropSepia } from "./backdrop-sepia";

describe("backdropSepia", () => {
	test("no-arg defaults to 1", async () => {
		expect(await declarations(backdropSepia())).toEqual([
			"--ui-backdrop-sepia: 1",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});

	test("an explicit partial amount", async () => {
		expect(await declarations(backdropSepia(0.6))).toEqual([
			"--ui-backdrop-sepia: 0.6",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});

	test("an explicit string amount passes through unchanged", async () => {
		expect(await declarations(backdropSepia("60%"))).toEqual([
			"--ui-backdrop-sepia: 60%",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});
});
