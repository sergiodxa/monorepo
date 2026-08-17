/**
 * Unit tests for `vars.ts`'s custom-property utility.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { vars } from "./vars";

describe("vars", () => {
	test("prefixes a single key with '--'", async () => {
		expect(await declarations(vars({ "sidebar-width": "18rem" }))).toEqual([
			"--sidebar-width: 18rem",
		]);
	});

	test("prefixes every key when given multiple entries", async () => {
		expect(await declarations(vars({ "sidebar-width": "18rem", "header-height": "4rem" }))).toEqual(
			["--sidebar-width: 18rem", "--header-height: 4rem"],
		);
	});

	test("passes numeric values through unchanged", async () => {
		// Custom properties are exempt from the serializer's unit-appending, so
		// a bare number stays bare here — unlike on a real CSS property, where
		// `10` would come out as `10px`. This is what lets every `transform/`
		// utility hand its `--ui-*` variable an unsuffixed factor.
		expect(await declarations(vars({ "z-index": 10 }))).toEqual(["--z-index: 10"]);
	});
});
