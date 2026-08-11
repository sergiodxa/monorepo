/**
 * Unit tests for `appearance()`'s default and explicit `appearance` value,
 * mirrored onto both vendor-prefixed properties, asserted against the CSS the
 * mixin actually serializes to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { appearance } from "./appearance";

describe("appearance", () => {
	test("defaults to none across the standard property and both vendor prefixes", async () => {
		expect(await declarations(appearance())).toEqual([
			"appearance: none",
			"-webkit-appearance: none",
			"-moz-appearance: none",
		]);
	});

	test("accepts an explicit value, mirrored the same way", async () => {
		expect(await declarations(appearance("auto"))).toEqual([
			"appearance: auto",
			"-webkit-appearance: auto",
			"-moz-appearance: auto",
		]);
	});

	test("omits MozAppearance when moz is disabled", async () => {
		let result = await declarations(appearance("none", { moz: false }));
		expect(result).toEqual(["appearance: none", "-webkit-appearance: none"]);
		expect(result.some((line) => line.startsWith("-moz-appearance:"))).toBe(false);
	});

	test("omits WebkitAppearance when webkit is disabled", async () => {
		let result = await declarations(appearance("none", { webkit: false }));
		expect(result).toEqual(["appearance: none", "-moz-appearance: none"]);
		expect(result.some((line) => line.startsWith("-webkit-appearance:"))).toBe(false);
	});

	test("the vendor prefixes keep their leading dash, which a camelCase key would lose", async () => {
		// `WebkitAppearance`/`MozAppearance` only kebab-case to `-webkit-…`/`-moz-…`
		// because of the capital first letter; a lowercase spelling would emit
		// `webkit-appearance`, a property no browser knows.
		let result = await declarations(appearance());

		expect(result.filter((line) => line.startsWith("-"))).toEqual([
			"-webkit-appearance: none",
			"-moz-appearance: none",
		]);
	});
});
