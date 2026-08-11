/**
 * Unit tests for `rotate()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";
import { COMPOSITE_TRANSFORM } from "../internal/transform";

import { rotate } from "./rotate";

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

	test("the emitted transform actually reads the custom property this utility set", async () => {
		// The whole composition scheme rests on the shared `transform` value
		// referencing every utility's variable: if the serializer reordered or
		// rewrote it, each utility would still set its variable and nothing
		// would move.
		let css = await declarations(rotate(45));

		expect(css).toContain("--ui-rotate: 45deg");
		expect(css.at(-1)).toContain("rotate(var(--ui-rotate, 0deg))");
	});
});
