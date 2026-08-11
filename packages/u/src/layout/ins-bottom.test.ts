/**
 * Unit tests for `insBottom()`'s physical `bottom` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { insBottom } from "./ins-bottom";

describe("insBottom", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(insBottom(4))).toEqual([
			"bottom: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("accepts 'auto'", async () => {
		expect(await declarations(insBottom("auto"))).toEqual(["bottom: auto"]);
	});

	test("accepts 'full'", async () => {
		expect(await declarations(insBottom("full"))).toEqual(["bottom: 100%"]);
	});

	test("passes a raw CSS length string through unchanged", async () => {
		expect(await declarations(insBottom("13px"))).toEqual(["bottom: 13px"]);
	});
});
