/**
 * Unit tests for `pbe()`'s `padding-block-end` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { pbe } from "./pbe";

describe("pbe", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(pbe(4))).toEqual([
			"padding-block-end: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});
});
