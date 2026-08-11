/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { counterIncrement } from "./counter-increment";

describe("counterIncrement", () => {
	test("no value falls back to CSS's own default", async () => {
		expect(await declarations(counterIncrement("section"))).toEqual(["counter-increment: section"]);
	});

	test("an explicit increment value", async () => {
		// The value is folded into the string here rather than left as a number,
		// which is what keeps the serializer from emitting `section 2px`.
		expect(await declarations(counterIncrement("section", 2))).toEqual([
			"counter-increment: section 2",
		]);
	});

	test("a negative increment value", async () => {
		expect(await declarations(counterIncrement("countdown", -1))).toEqual([
			"counter-increment: countdown -1",
		]);
	});
});
