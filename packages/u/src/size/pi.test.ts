/**
 * Unit tests for `pi()`'s 1/2-value `padding-inline` shorthand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { pi } from "./pi";

describe("pi", () => {
	test("one value applies both inline edges", async () => {
		expect(await declarations(pi(4))).toEqual([
			"padding-inline: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("two values map to inline-start then inline-end", async () => {
		expect(await declarations(pi(1, 2))).toEqual([
			"padding-inline: calc(var(--ui-spacing, 0.25rem) * 1) calc(var(--ui-spacing, 0.25rem) * 2)",
		]);
	});
});
