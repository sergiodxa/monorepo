/**
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
		// The value is folded into the string here rather than left as a number,
		// which is what keeps the serializer from emitting `chapter 5px`.
		expect(await declarations(counterReset("chapter", 5))).toEqual(["counter-reset: chapter 5"]);
	});
});
