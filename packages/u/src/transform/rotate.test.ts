/**
 * Unit tests for `rotate()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";
import { COMPOSITE_TRANSFORM } from "../internal/transform.js";

import { rotate } from "./rotate.js";

describe("rotate", () => {
	test("treats a bare number as degrees", async () => {
		expect(await declarations(rotate(45))).toEqual([
			"--ui-rotate: 45deg",
			`transform: ${COMPOSITE_TRANSFORM}`,
		]);
	});

	test("passes a string through unchanged", async () => {
		expect(await declarations(rotate("0.25turn"))).toEqual([
			"--ui-rotate: 0.25turn",
			`transform: ${COMPOSITE_TRANSFORM}`,
		]);
	});

	/**
	 * The shared `transform` declaration must keep referencing this utility's
	 * custom property through serialization, since that reference is what
	 * makes the rotation take effect.
	 */
	test("the emitted transform actually reads the custom property this utility set", async () => {
		let css = await declarations(rotate(45));

		expect(css).toContain("--ui-rotate: 45deg");
		expect(css.at(-1)).toContain("rotate(var(--ui-rotate, 0deg))");
	});
});
