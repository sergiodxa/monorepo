/**
 * Unit tests for `insBs()`'s `inset-block-start` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { insBs } from "./ins-bs";

describe("insBs", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(insBs(4))).toEqual([
			"inset-block-start: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});
});
