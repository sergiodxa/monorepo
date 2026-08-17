/**
 * Unit tests for `place()`'s partial-options behavior: only the given
 * option keys should produce a property, with no stray `undefined`
 * properties for the omitted one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { place } from "./place";

describe("place", () => {
	test("no options emits no declarations", async () => {
		expect(await declarations(place())).toEqual([]);
	});

	test("only items given sets align-items and justify-items, and nothing else", async () => {
		expect(await declarations(place({ items: "center" }))).toEqual([
			"align-items: center",
			"justify-items: center",
		]);
	});

	test("only content given sets align-content and justify-content, and nothing else", async () => {
		expect(await declarations(place({ content: "between" }))).toEqual([
			"align-content: space-between",
			"justify-content: space-between",
		]);
	});

	test("both given sets all four properties, aliasing content the same way u.justify() does", async () => {
		expect(await declarations(place({ items: "center", content: "between" }))).toEqual([
			"align-items: center",
			"justify-items: center",
			"align-content: space-between",
			"justify-content: space-between",
		]);
	});
});
