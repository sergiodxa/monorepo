/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { transitionDelay } from "./transition-delay";

describe("transitionDelay", () => {
	test("no-arg defaults to 0s", async () => {
		expect(await declarations(transitionDelay())).toEqual(["transition-delay: 0s"]);
	});

	test("sets only transition-delay", async () => {
		expect(await declarations(transitionDelay("120ms"))).toEqual(["transition-delay: 120ms"]);
	});

	test("passes through an arbitrary delay string unchanged", async () => {
		expect(await declarations(transitionDelay("calc(var(--index) * 40ms)"))).toEqual([
			"transition-delay: calc(var(--index) * 40ms)",
		]);
	});
});
