/**
 * Unit tests for `vars.ts`'s custom-property utility. Custom properties are
 * exempt from the serializer's unit-appending, so a numeric value stays bare,
 * which lets the transform utilities pass an unsuffixed factor through their
 * `--ui-*` variables.
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
		expect(await declarations(vars({ "z-index": 10 }))).toEqual(["--z-index: 10"]);
	});
});
