/**
 * Unit tests for `pis()`'s `padding-inline-start` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { pis } from "./pis";

describe("pis", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(pis(4))).toEqual([
			"padding-inline-start: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});
});
