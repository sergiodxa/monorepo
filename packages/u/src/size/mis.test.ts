/**
 * Unit tests for `mis()`'s `margin-inline-start` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { mis } from "./mis";

describe("mis", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(mis(4))).toEqual([
			"margin-inline-start: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("passes 'auto' through unchanged", async () => {
		expect(await declarations(mis("auto"))).toEqual(["margin-inline-start: auto"]);
	});
});
