/**
 * Unit tests for `insTop()`'s physical `top` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { insTop } from "./ins-top";

describe("insTop", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(insTop(4))).toEqual(["top: calc(var(--ui-spacing, 0.25rem) * 4)"]);
	});

	test("accepts 'auto'", async () => {
		expect(await declarations(insTop("auto"))).toEqual(["top: auto"]);
	});

	test("accepts 'full'", async () => {
		expect(await declarations(insTop("full"))).toEqual(["top: 100%"]);
	});

	test("passes a raw CSS length string through unchanged", async () => {
		expect(await declarations(insTop("13px"))).toEqual(["top: 13px"]);
	});
});
