/**
 * Unit tests for `gap()`'s 1/2-value `gap` resolution built on the shared
 * `resolveEdge` helper.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { gap } from "./gap";

describe("gap", () => {
	test("one value applies to both row and column gap", async () => {
		expect(await declarations(gap(4))).toEqual(["gap: calc(var(--ui-spacing, 0.25rem) * 4)"]);
	});

	test("two values are read as row then column", async () => {
		expect(await declarations(gap(2, 4))).toEqual([
			"gap: calc(var(--ui-spacing, 0.25rem) * 2) calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("throws for an unsupported value count", async () => {
		expect(() => gap()).toThrow();
		expect(() => gap(1, 2, 3)).toThrow();
	});
});
