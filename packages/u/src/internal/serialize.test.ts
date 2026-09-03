/**
 * The CSS serializer appends `px` to a unitless number on any property
 * outside its unitless list, so every mixin that emits a caller-chosen
 * number is listed here and asserted to survive serialization unit-free.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { animationHost } from "../animation/animation.js";
import { fillOpacity } from "../color/fill-opacity.js";
import { opacity } from "../effects/opacity.js";
import { gridRow } from "../layout/grid-row.js";
import { aspect } from "../size/aspect.js";
import { p } from "../size/p.js";
import { z } from "../stacking/z.js";
import { leading } from "../typography/leading.js";
import { lineClamp } from "../typography/line-clamp.js";
import { weight } from "../typography/weight.js";

import { declarations, serialize } from "./serialize.js";

describe("serialize", () => {
	test("returns the stylesheet text, layer and selector included", async () => {
		let css = await serialize(p(4));

		expect(css).toContain("@layer");
		expect(css).toContain("padding: calc(var(--ui-spacing, 0.25rem) * 4);");
	});
});

describe("declarations", () => {
	test("flattens the stylesheet down to property/value pairs", async () => {
		expect(await declarations(p(4))).toEqual(["padding: calc(var(--ui-spacing, 0.25rem) * 4)"]);
	});
});

describe("unitless numeric values", () => {
	test.each([
		["-webkit-line-clamp: 3", lineClamp(3)],
		["fill-opacity: 0.5", fillOpacity(50)],
		[
			"animation-iteration-count: 2",
			animationHost("bounce", { duration: "300ms", iterationCount: 2 }),
		],
		["opacity: 0.5", opacity(50)],
		["font-weight: 600", weight(600)],
		["z-index: 10", z(10)],
		["grid-row: 2", gridRow(2)],
		["line-height: 1.8", leading(1.8)],
		["aspect-ratio: 16 / 9", aspect(16, 9)],
	])("%s survives serialization without a px suffix", async (expected, mixin) => {
		expect(await declarations(mixin)).toContain(expected);
	});
});
