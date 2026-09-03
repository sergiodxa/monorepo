/**
 * Unit tests for `interpolateSize()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { interpolateSize } from "./interpolate-size.js";

describe("interpolateSize", () => {
	test("defaults to allow-keywords", async () => {
		expect(await declarations(interpolateSize())).toEqual(["interpolate-size: allow-keywords"]);
	});

	test("accepts an explicit value", async () => {
		expect(await declarations(interpolateSize("numeric-only"))).toEqual([
			"interpolate-size: numeric-only",
		]);
	});
});
