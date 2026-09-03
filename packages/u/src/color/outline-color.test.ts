/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { outlineColor } from "./outline-color.js";

describe("outlineColor", () => {
	test("no-arg resolves the system default ring color", async () => {
		expect(await declarations(outlineColor())).toEqual([
			"outline-color: var(--ui-ring, Highlight)",
		]);
	});

	test("a tone resolves to its ring variable", async () => {
		expect(await declarations(outlineColor("danger"))).toEqual([
			"outline-color: var(--ui-danger-ring)",
		]);
	});

	test("sets only outlineColor, no width or style", async () => {
		let css = await declarations(outlineColor("danger"));

		expect(css.some((line) => line.startsWith("outline-width"))).toBe(false);
		expect(css.some((line) => line.startsWith("outline-style"))).toBe(false);
	});
});
