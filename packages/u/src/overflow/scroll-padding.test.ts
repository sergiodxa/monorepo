/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { scrollPadding } from "./scroll-padding";

describe("scrollPadding", () => {
	test("one value applies uniformly", async () => {
		expect(await declarations(scrollPadding(4))).toEqual([
			"scroll-padding: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("two values map to block then inline", async () => {
		expect(await declarations(scrollPadding(16, 0))).toEqual([
			"scroll-padding-block: calc(var(--ui-spacing, 0.25rem) * 16)",
			"scroll-padding-inline: calc(var(--ui-spacing, 0.25rem) * 0)",
		]);
	});

	test("four values map to block-start, inline-end, block-end, inline-start", async () => {
		expect(await declarations(scrollPadding(1, 2, 3, 4))).toEqual([
			"scroll-padding-block-start: calc(var(--ui-spacing, 0.25rem) * 1)",
			"scroll-padding-inline-end: calc(var(--ui-spacing, 0.25rem) * 2)",
			"scroll-padding-block-end: calc(var(--ui-spacing, 0.25rem) * 3)",
			"scroll-padding-inline-start: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("a raw CSS length passes through", async () => {
		expect(await declarations(scrollPadding("3rem"))).toEqual(["scroll-padding: 3rem"]);
	});

	test("throws for an unsupported value count", () => {
		expect(() => scrollPadding(1, 2, 3)).toThrow();
		expect(() => scrollPadding()).toThrow();
	});
});
