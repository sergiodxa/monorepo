/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { text } from "./text";

describe("text", () => {
	test("a named size resolves fontSize and its paired lineHeight", async () => {
		expect(await declarations(text("lg"))).toEqual([
			"font-size: var(--ui-text-lg, 1.125rem)",
			"line-height: var(--ui-leading-lg, calc(1.75 / 1.125))",
		]);
	});

	test("another named size resolves its own fallback and paired lineHeight", async () => {
		expect(await declarations(text("9xl"))).toEqual([
			"font-size: var(--ui-text-9xl, 8rem)",
			"line-height: var(--ui-leading-9xl, 1)",
		]);
	});

	test("'sm' resolves the exact ratio call sites depend on when sweeping hardcoded font-size/line-height literals", async () => {
		expect(await declarations(text("sm"))).toEqual([
			"font-size: var(--ui-text-sm, 0.875rem)",
			"line-height: var(--ui-leading-sm, calc(1.25 / 0.875))",
		]);
	});

	test("'xs' resolves the exact ratio call sites depend on when sweeping hardcoded font-size/line-height literals", async () => {
		expect(await declarations(text("xs"))).toEqual([
			"font-size: var(--ui-text-xs, 0.75rem)",
			"line-height: var(--ui-leading-xs, calc(1 / 0.75))",
		]);
	});
});
