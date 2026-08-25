/**
 * Unit tests for `counterReset()`. The value is folded into the string so the
 * serializer emits a bare integer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { counterReset } from "./counter-reset";

describe("counterReset", () => {
	test("no value falls back to CSS's own default", async () => {
		expect(await declarations(counterReset("section"))).toEqual(["counter-reset: section"]);
	});

	test("an explicit starting value", async () => {
		expect(await declarations(counterReset("section", 0))).toEqual(["counter-reset: section 0"]);
	});

	test("a non-zero starting value", async () => {
		expect(await declarations(counterReset("chapter", 5))).toEqual(["counter-reset: chapter 5"]);
	});
});
