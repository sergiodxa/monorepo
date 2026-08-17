/**
 * Unit tests for `mie()`'s `margin-inline-end` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { mie } from "./mie";

describe("mie", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(mie(4))).toEqual([
			"margin-inline-end: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("passes 'auto' through unchanged", async () => {
		expect(await declarations(mie("auto"))).toEqual(["margin-inline-end: auto"]);
	});
});
