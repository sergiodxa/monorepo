/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { positionTryFallbacks } from "./position-try-fallbacks";

describe("positionTryFallbacks", () => {
	test("sets a single fallback", async () => {
		expect(await declarations(positionTryFallbacks("flip-block"))).toEqual([
			"position-try-fallbacks: flip-block",
		]);
	});

	test("joins multiple fallbacks with a comma", async () => {
		expect(await declarations(positionTryFallbacks("flip-block", "flip-inline"))).toEqual([
			"position-try-fallbacks: flip-block, flip-inline",
		]);
	});

	test("accepts a custom-position-try reference", async () => {
		expect(await declarations(positionTryFallbacks("--custom-fallback"))).toEqual([
			"position-try-fallbacks: --custom-fallback",
		]);
	});
});
