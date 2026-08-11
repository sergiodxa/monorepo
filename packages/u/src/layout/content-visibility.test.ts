/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { contentVisibility } from "./content-visibility";

describe("contentVisibility", () => {
	test("defaults to auto", async () => {
		expect(await declarations(contentVisibility())).toEqual(["content-visibility: auto"]);
	});

	test("'visible'", async () => {
		expect(await declarations(contentVisibility("visible"))).toEqual([
			"content-visibility: visible",
		]);
	});

	test("'hidden'", async () => {
		expect(await declarations(contentVisibility("hidden"))).toEqual(["content-visibility: hidden"]);
	});

	test("does not reserve a placeholder size the way virtualize() does", async () => {
		let css = await declarations(contentVisibility("auto"));

		expect(css.some((line) => line.startsWith("contain-intrinsic-size:"))).toBe(false);
	});
});
