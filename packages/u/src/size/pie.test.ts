/**
 * Unit tests for `pie()`'s `padding-inline-end` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { pie } from "./pie.js";

describe("pie", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(pie(4))).toEqual([
			"padding-inline-end: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});
});
