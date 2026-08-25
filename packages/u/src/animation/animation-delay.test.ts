/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { animationDelay } from "./animation-delay";

describe("animationDelay", () => {
	test("passes the given time value through unchanged", async () => {
		expect(await declarations(animationDelay("150ms"))).toEqual(["animation-delay: 150ms"]);
	});

	test("defaults to 0s when no value is given", async () => {
		expect(await declarations(animationDelay())).toEqual(["animation-delay: 0s"]);
	});

	test("keeps a negative delay, which seeks into the animation instead of waiting", async () => {
		expect(await declarations(animationDelay("-500ms"))).toEqual(["animation-delay: -500ms"]);
	});

	test("accepts a computed per-item delay for staggering", async () => {
		expect(await declarations(animationDelay(`${2 * 60}ms`))).toEqual(["animation-delay: 120ms"]);
	});

	test("emits only animationDelay, never animationName or animationDuration", async () => {
		expect(await declarations(animationDelay("150ms"))).toEqual(["animation-delay: 150ms"]);
	});
});
