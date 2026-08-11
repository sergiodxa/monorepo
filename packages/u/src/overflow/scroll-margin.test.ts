/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { scrollMargin } from "./scroll-margin";

describe("scrollMargin", () => {
	test("one value applies uniformly", async () => {
		expect(await declarations(scrollMargin(4))).toEqual([
			"scroll-margin: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("two values map to block then inline", async () => {
		expect(await declarations(scrollMargin(16, 0))).toEqual([
			"scroll-margin-block: calc(var(--ui-spacing, 0.25rem) * 16)",
			"scroll-margin-inline: calc(var(--ui-spacing, 0.25rem) * 0)",
		]);
	});

	test("four values map to block-start, inline-end, block-end, inline-start", async () => {
		expect(await declarations(scrollMargin(1, 2, 3, 4))).toEqual([
			"scroll-margin-block-start: calc(var(--ui-spacing, 0.25rem) * 1)",
			"scroll-margin-inline-end: calc(var(--ui-spacing, 0.25rem) * 2)",
			"scroll-margin-block-end: calc(var(--ui-spacing, 0.25rem) * 3)",
			"scroll-margin-inline-start: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("a raw CSS length passes through", async () => {
		expect(await declarations(scrollMargin("3rem"))).toEqual(["scroll-margin: 3rem"]);
	});

	test("throws for an unsupported value count", () => {
		expect(() => scrollMargin(1, 2, 3)).toThrow();
		expect(() => scrollMargin()).toThrow();
	});
});
