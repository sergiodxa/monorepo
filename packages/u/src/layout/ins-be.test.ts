/**
 * Unit tests for `insBe()`'s `inset-block-end` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { insBe } from "./ins-be";

describe("insBe", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(insBe(4))).toEqual([
			"inset-block-end: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});
});
