/**
 * Unit tests for `transformStyle()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { transformStyle } from "./transform-style";

describe("transformStyle", () => {
	test("defaults to preserve-3d", async () => {
		expect(await declarations(transformStyle())).toEqual(["transform-style: preserve-3d"]);
	});

	test("accepts preserve-3d explicitly", async () => {
		expect(await declarations(transformStyle("preserve-3d"))).toEqual([
			"transform-style: preserve-3d",
		]);
	});

	test("accepts flat", async () => {
		expect(await declarations(transformStyle("flat"))).toEqual(["transform-style: flat"]);
	});

	test("never emits a composite transform declaration", async () => {
		// `transform-style` is its own property; emitting the shared composite
		// `transform` alongside it would create a stacking/containing-block
		// context the caller never asked for.
		let css = await declarations(transformStyle());

		expect(css.some((line) => line.startsWith("transform:"))).toBe(false);
	});
});
