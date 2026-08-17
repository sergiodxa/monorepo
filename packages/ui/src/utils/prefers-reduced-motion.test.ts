/**
 * Unit tests for {@link "./prefers-reduced-motion"}: every assertion stubs
 * `window.matchMedia` with a stand-in reporting a fixed `matches` value and a
 * query recorded for inspection, matching the single property {@link
 * prefersReducedMotion} ever touches, then restores it once the test
 * finishes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "vitest";

import { prefersReducedMotion } from "./prefers-reduced-motion";

/**
 * Stands a `window.matchMedia` stub in for the test's duration, always
 * reporting `matches` and recording the last query it was called with, and
 * returns a reader for that query.
 */
function stubMatchMedia(matches: boolean): () => string | undefined {
	let lastQuery: string | undefined;

	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {
			matchMedia(query: string) {
				lastQuery = query;
				return { matches } as MediaQueryList;
			},
		},
	});

	return () => lastQuery;
}

describe(prefersReducedMotion.name, () => {
	afterEach(() => {
		delete (globalThis as { window?: unknown }).window;
	});

	test("returns true when the platform matches prefers-reduced-motion: reduce", () => {
		stubMatchMedia(true);

		expect(prefersReducedMotion()).toBe(true);
	});

	test("returns false when the platform does not match", () => {
		stubMatchMedia(false);

		expect(prefersReducedMotion()).toBe(false);
	});

	test("queries the exact prefers-reduced-motion: reduce media feature", () => {
		let readQuery = stubMatchMedia(false);

		prefersReducedMotion();

		expect(readQuery()).toBe("(prefers-reduced-motion: reduce)");
	});
});
