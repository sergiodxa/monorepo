/**
 * Unit tests for `counterIncrement()`. The value is folded into the string so
 * the serializer emits a bare integer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { counterIncrement } from "./counter-increment.js";

describe("counterIncrement", () => {
	test("no value falls back to CSS's own default", async () => {
		expect(await declarations(counterIncrement("section"))).toEqual(["counter-increment: section"]);
	});

	test("an explicit increment value", async () => {
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
