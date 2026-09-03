/**
 * Unit tests for `m()`'s 1/2/4-value logical margin shorthand, including
 * `"auto"` for centering.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { m } from "./m.js";

describe("m", () => {
	test("one value applies uniformly", async () => {
		expect(await declarations(m(4))).toEqual(["margin: calc(var(--ui-spacing, 0.25rem) * 4)"]);
	});

	test("two values map to block then inline", async () => {
		expect(await declarations(m(1, 2))).toEqual([
			"margin-block: calc(var(--ui-spacing, 0.25rem) * 1)",
			"margin-inline: calc(var(--ui-spacing, 0.25rem) * 2)",
		]);
	});

	test("four values map to block-start, inline-end, block-end, inline-start", async () => {
		expect(await declarations(m(1, 2, 3, 4))).toEqual([
			"margin-block-start: calc(var(--ui-spacing, 0.25rem) * 1)",
			"margin-inline-end: calc(var(--ui-spacing, 0.25rem) * 2)",
			"margin-block-end: calc(var(--ui-spacing, 0.25rem) * 3)",
			"margin-inline-start: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("accepts 'auto' anywhere in the 1/2/4-value forms", async () => {
		expect(await declarations(m(4, "auto"))).toEqual([
			"margin-block: calc(var(--ui-spacing, 0.25rem) * 4)",
			"margin-inline: auto",
		]);
	});
});
