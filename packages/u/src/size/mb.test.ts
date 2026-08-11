/**
 * Unit tests for `mb()`'s 1/2-value `margin-block` shorthand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { mb } from "./mb";

describe("mb", () => {
	test("one value applies both block edges", async () => {
		expect(await declarations(mb(4))).toEqual([
			"margin-block: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("two values map to block-start then block-end, accepting 'auto'", async () => {
		expect(await declarations(mb(4, "auto"))).toEqual([
			"margin-block: calc(var(--ui-spacing, 0.25rem) * 4) auto",
		]);
	});
});
