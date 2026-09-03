/**
 * Unit tests for `p()`'s 1/2/4-value logical padding shorthand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { p } from "./p.js";

describe("p", () => {
	test("one value applies uniformly", async () => {
		expect(await declarations(p(4))).toEqual(["padding: calc(var(--ui-spacing, 0.25rem) * 4)"]);
	});

	test("two values map to block then inline", async () => {
		expect(await declarations(p(1, 2))).toEqual([
			"padding-block: calc(var(--ui-spacing, 0.25rem) * 1)",
			"padding-inline: calc(var(--ui-spacing, 0.25rem) * 2)",
		]);
	});

	test("four values map to block-start, inline-end, block-end, inline-start", async () => {
		expect(await declarations(p(1, 2, 3, 4))).toEqual([
			"padding-block-start: calc(var(--ui-spacing, 0.25rem) * 1)",
			"padding-inline-end: calc(var(--ui-spacing, 0.25rem) * 2)",
			"padding-block-end: calc(var(--ui-spacing, 0.25rem) * 3)",
			"padding-inline-start: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});
});
