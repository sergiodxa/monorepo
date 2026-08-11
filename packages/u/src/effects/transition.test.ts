/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { transition } from "./transition";

describe("transition", () => {
	test("defaults to the standard easing and a 150ms duration", async () => {
		expect(await declarations(transition("color, background-color"))).toEqual([
			"transition-property: color, background-color",
			"transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1)",
			"transition-duration: 150ms",
		]);
	});

	test("a numeric duration is treated as milliseconds", async () => {
		expect(await declarations(transition("transform", { duration: 200 }))).toEqual([
			"transition-property: transform",
			"transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1)",
			"transition-duration: 200ms",
		]);
	});

	test("a string duration passes through unchanged", async () => {
		expect(await declarations(transition("opacity", { duration: "0s" }))).toEqual([
			"transition-property: opacity",
			"transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1)",
			"transition-duration: 0s",
		]);
	});

	test("a custom easing overrides the default curve", async () => {
		expect(await declarations(transition("box-shadow", { easing: "linear" }))).toEqual([
			"transition-property: box-shadow",
			"transition-timing-function: linear",
			"transition-duration: 150ms",
		]);
	});
});
