/**
 * Unit tests for `insIs()`'s `inset-inline-start` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { insIs } from "./ins-is";

describe("insIs", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(insIs(4))).toEqual([
			"inset-inline-start: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});
});
