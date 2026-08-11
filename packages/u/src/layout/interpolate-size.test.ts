/**
 * Unit tests for `interpolateSize()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { interpolateSize } from "./interpolate-size";

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
