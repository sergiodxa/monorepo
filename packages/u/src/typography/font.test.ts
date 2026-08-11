/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { font } from "./font";

describe("font", () => {
	test("a named family resolves fontFamily", async () => {
		expect(await declarations(font("serif"))).toEqual([
			"font-family: var(--ui-font-serif, ui-serif, Georgia, serif)",
		]);
	});

	test("another named family resolves its own fallback stack", async () => {
		expect(await declarations(font("mono"))).toEqual([
			"font-family: var(--ui-font-mono, ui-monospace, SFMono-Regular, monospace)",
		]);
	});

	test("'inherit' passes through unchanged instead of being var()-wrapped", async () => {
		expect(await declarations(font("inherit"))).toEqual(["font-family: inherit"]);
	});

	test("'unset' passes through unchanged instead of being var()-wrapped", async () => {
		expect(await declarations(font("unset"))).toEqual(["font-family: unset"]);
	});
});
