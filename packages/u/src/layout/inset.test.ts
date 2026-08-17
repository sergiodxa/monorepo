/**
 * Unit tests for `inset()`'s 1/2/4-value logical `inset` shorthand
 * resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { inset } from "./inset";

describe("inset", () => {
	test("one value applies uniformly", async () => {
		expect(await declarations(inset(4))).toEqual(["inset: calc(var(--ui-spacing, 0.25rem) * 4)"]);
	});

	test("two values map to block then inline", async () => {
		expect(await declarations(inset(4, "auto"))).toEqual([
			"inset-block: calc(var(--ui-spacing, 0.25rem) * 4)",
			"inset-inline: auto",
		]);
	});

	test("four values map to block-start, inline-end, block-end, inline-start", async () => {
		expect(await declarations(inset(1, 2, 3, 4))).toEqual([
			"inset-block-start: calc(var(--ui-spacing, 0.25rem) * 1)",
			"inset-inline-end: calc(var(--ui-spacing, 0.25rem) * 2)",
			"inset-block-end: calc(var(--ui-spacing, 0.25rem) * 3)",
			"inset-inline-start: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});
});
