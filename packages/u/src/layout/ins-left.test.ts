/**
 * Unit tests for `insLeft()`'s physical `left` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { insLeft } from "./ins-left";

describe("insLeft", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(insLeft(4))).toEqual(["left: calc(var(--ui-spacing, 0.25rem) * 4)"]);
	});

	test("accepts 'auto'", async () => {
		expect(await declarations(insLeft("auto"))).toEqual(["left: auto"]);
	});

	test("accepts 'full'", async () => {
		expect(await declarations(insLeft("full"))).toEqual(["left: 100%"]);
	});

	test("passes a raw CSS length string through unchanged", async () => {
		expect(await declarations(insLeft("13px"))).toEqual(["left: 13px"]);
	});
});
