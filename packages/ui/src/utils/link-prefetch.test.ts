/**
 * Tests for the link prefetch contract: only the runtime's modes reach
 * `data-rmx-prefetch`, and the `<link rel="prefetch">` hint needs a destination.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { prefetchAttribute, rendersPrefetchHint } from "./link-prefetch.js";

describe(prefetchAttribute.name, () => {
	test.each(["intent", "viewport"] as const)("writes %s for the runtime", (mode) => {
		expect(prefetchAttribute(mode)).toBe(mode);
	});

	test.each(["none", "render"] as const)("leaves the attribute off for %s", (mode) => {
		expect(prefetchAttribute(mode)).toBeUndefined();
	});
});

describe(rendersPrefetchHint.name, () => {
	test("renders the hint for a destination in render mode", () => {
		expect(rendersPrefetchHint("render", "/posts/1")).toBe(true);
	});

	test.each([undefined, ""])("skips the hint without a destination (%j)", (href) => {
		expect(rendersPrefetchHint("render", href)).toBe(false);
	});

	test("skips the hint in every other mode", () => {
		expect(rendersPrefetchHint("intent", "/posts/1")).toBe(false);
	});
});
