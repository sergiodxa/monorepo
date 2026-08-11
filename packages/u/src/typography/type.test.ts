/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { type } from "./type";

describe("type", () => {
	test("combines text()'s font-size/line-height with the base sans font family", async () => {
		expect(await declarations(type("lg"))).toEqual([
			"font-family: var(--ui-font-sans, ui-sans-serif, system-ui, sans-serif)",
			"font-size: var(--ui-text-lg, 1.125rem)",
			"line-height: var(--ui-leading-lg, calc(1.75 / 1.125))",
		]);
	});

	test("always opinionates the family to sans regardless of the text size requested", async () => {
		expect(await declarations(type("3xl"))).toEqual([
			"font-family: var(--ui-font-sans, ui-sans-serif, system-ui, sans-serif)",
			"font-size: var(--ui-text-3xl, 1.875rem)",
			"line-height: var(--ui-leading-3xl, 1.2)",
		]);
	});
});
