/**
 * Unit tests for `insIe()`'s `inset-inline-end` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vite-plus/test";

import { declarations } from "../internal/serialize.js";

import { insIe } from "./ins-ie.js";

describe("insIe", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(insIe(4))).toEqual([
			"inset-inline-end: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});
});
