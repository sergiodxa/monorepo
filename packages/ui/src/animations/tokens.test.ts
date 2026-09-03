/**
 * Unit tests for the shared motion vocabulary in {@link "./tokens"}: every
 * assertion reads a token object's exact value directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { durations, easings } from "./tokens.js";

describe("easings", () => {
	test("standard is the general-purpose enter/exit curve", () => {
		expect(easings.standard).toBe("cubic-bezier(0.4, 0, 0.2, 1)");
	});

	test("decelerate reads as an arrival", () => {
		expect(easings.decelerate).toBe("cubic-bezier(0, 0, 0.2, 1)");
	});

	test("accelerate reads as a departure", () => {
		expect(easings.accelerate).toBe("cubic-bezier(0.4, 0, 1, 1)");
	});

	test("linear matches the platform keyword", () => {
		expect(easings.linear).toBe("linear");
	});
});

describe("durations", () => {
	test("fast suits small, trigger-anchored surfaces", () => {
		expect(durations.fast).toBe(150);
	});

	test("normal is the default for most overlays", () => {
		expect(durations.normal).toBe(200);
	});

	test("slow suits larger, viewport-covering surfaces", () => {
		expect(durations.slow).toBe(300);
	});

	test("slower suits the largest surfaces or secondary motion", () => {
		expect(durations.slower).toBe(400);
	});
});
