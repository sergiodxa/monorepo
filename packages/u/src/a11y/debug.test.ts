/**
 * Under `bun test`, `import.meta.env` is Bun's live alias for `process.env` —
 * `import.meta.env.DEV` is not derived from `NODE_ENV` the way a Vite-style
 * bundler would derive it, it is simply `process.env.DEV`. That means both of
 * `debug()`'s branches are directly reachable in a plain `bun:test` file by
 * setting or deleting `process.env.DEV` around each assertion, with no need
 * for module mocking.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { debug } from "./debug";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

let originalDev: string | undefined;

beforeEach(() => {
	originalDev = process.env.DEV;
});

afterEach(() => {
	if (originalDev === undefined) delete process.env.DEV;
	else process.env.DEV = originalDev;
});

describe("debug", () => {
	describe("outside development", () => {
		test("resolves to an empty style tree regardless of mode", () => {
			delete process.env.DEV;

			expect(styles(debug())).toEqual({});
			expect(styles(debug(true))).toEqual({});
			expect(styles(debug("nested"))).toEqual({});
		});
	});

	describe("in development", () => {
		beforeEach(() => {
			process.env.DEV = "1";
		});

		test("the bare/true form outlines only the host", () => {
			expect(styles(debug())).toEqual({
				outline: "2px solid red",
				outlineOffset: "-2px",
			});
			expect(styles(debug(true))).toEqual({
				outline: "2px solid red",
				outlineOffset: "-2px",
			});
		});

		test('the "nested" form outlines the host plus every descendant through "& *"', () => {
			expect(styles(debug("nested"))).toEqual({
				outline: "2px solid red",
				outlineOffset: "-2px",
				"& *": {
					outline: "2px solid red",
					outlineOffset: "-2px",
				},
			});
		});
	});
});
