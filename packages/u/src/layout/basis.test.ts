/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { basis } from "./basis";

describe("basis", () => {
	test("no-arg defaults to auto", async () => {
		expect(await declarations(basis())).toEqual(["flex-basis: auto"]);
	});

	test("a spacing-scale number", async () => {
		expect(await declarations(basis(4))).toEqual([
			"flex-basis: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("a raw percentage string", async () => {
		expect(await declarations(basis("0%"))).toEqual(["flex-basis: 0%"]);
	});
});
