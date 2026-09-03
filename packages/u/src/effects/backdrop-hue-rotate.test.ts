/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { COMPOSITE_BACKDROP_FILTER } from "../internal/backdrop-filter.js";
import { declarations } from "../internal/serialize.js";

import { backdropHueRotate } from "./backdrop-hue-rotate.js";

describe("backdropHueRotate", () => {
	test("no-arg defaults to 90deg", async () => {
		expect(await declarations(backdropHueRotate())).toEqual([
			"--ui-backdrop-hue-rotate: 90deg",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});

	test("a bare number is treated as degrees", async () => {
		expect(await declarations(backdropHueRotate(180))).toEqual([
			"--ui-backdrop-hue-rotate: 180deg",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});

	test("a raw angle string passes through unchanged", async () => {
		expect(await declarations(backdropHueRotate("0.5turn"))).toEqual([
			"--ui-backdrop-hue-rotate: 0.5turn",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});
});
