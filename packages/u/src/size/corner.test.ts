/**
 * Unit tests for `corner()`'s `@supports`-gated `corner-shape` primitive.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations, serialize } from "../internal/serialize";

import { corner } from "./corner";

describe("corner", () => {
	test("nests 'squircle' under an @supports block for that shape", async () => {
		expect(await serialize(corner("squircle"))).toContain("@supports (corner-shape: squircle)");
		expect(await declarations(corner("squircle"))).toEqual(["corner-shape: squircle"]);
	});

	test("nests 'bevel' under an @supports block for that shape", async () => {
		expect(await serialize(corner("bevel"))).toContain("@supports (corner-shape: bevel)");
		expect(await declarations(corner("bevel"))).toEqual(["corner-shape: bevel"]);
	});

	test("nests 'notch' under an @supports block for that shape", async () => {
		expect(await serialize(corner("notch"))).toContain("@supports (corner-shape: notch)");
		expect(await declarations(corner("notch"))).toEqual(["corner-shape: notch"]);
	});

	test("the declaration lives inside the @supports block, never beside it", async () => {
		let css = await serialize(corner("squircle"));

		expect(css.indexOf("@supports")).toBeLessThan(css.indexOf("corner-shape:"));
	});
});
