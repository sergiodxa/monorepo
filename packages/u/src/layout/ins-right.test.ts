/**
 * Unit tests for `insRight()`'s physical `right` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { insRight } from "./ins-right";

describe("insRight", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(insRight(4))).toEqual([
			"right: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("accepts 'auto'", async () => {
		expect(await declarations(insRight("auto"))).toEqual(["right: auto"]);
	});

	test("accepts 'full'", async () => {
		expect(await declarations(insRight("full"))).toEqual(["right: 100%"]);
	});

	test("passes a raw CSS length string through unchanged", async () => {
		expect(await declarations(insRight("13px"))).toEqual(["right: 13px"]);
	});
});
