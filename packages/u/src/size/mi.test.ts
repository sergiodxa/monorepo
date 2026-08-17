/**
 * Unit tests for `mi()`'s 1/2-value `margin-inline` shorthand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { mi } from "./mi";

describe("mi", () => {
	test("one value applies both inline edges", async () => {
		expect(await declarations(mi(4))).toEqual([
			"margin-inline: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("two values map to inline-start then inline-end, accepting 'auto'", async () => {
		expect(await declarations(mi(4, "auto"))).toEqual([
			"margin-inline: calc(var(--ui-spacing, 0.25rem) * 4) auto",
		]);
	});
});
