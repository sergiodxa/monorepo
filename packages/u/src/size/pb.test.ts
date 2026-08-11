/**
 * Unit tests for `pb()`'s 1/2-value `padding-block` shorthand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { pb } from "./pb";

describe("pb", () => {
	test("one value applies both block edges", async () => {
		expect(await declarations(pb(4))).toEqual([
			"padding-block: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("two values map to block-start then block-end", async () => {
		expect(await declarations(pb(1, 2))).toEqual([
			"padding-block: calc(var(--ui-spacing, 0.25rem) * 1) calc(var(--ui-spacing, 0.25rem) * 2)",
		]);
	});
});
