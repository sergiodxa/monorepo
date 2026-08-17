/**
 * `import.meta.env.DEV` reads through to `process.env.DEV` at call time, so both
 * of `debug()`'s branches are reachable by setting or deleting `process.env.DEV`
 * around each assertion, with no module mocking.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { declarations, serialize } from "../internal/serialize";

import { debug } from "./debug";

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
		test("emits no declarations at all regardless of mode", async () => {
			delete process.env.DEV;

			expect(await declarations(debug())).toEqual([]);
			expect(await declarations(debug(true))).toEqual([]);
			expect(await declarations(debug("nested"))).toEqual([]);
		});
	});

	describe("in development", () => {
		beforeEach(() => {
			process.env.DEV = "1";
		});

		test("the bare/true form outlines only the host", async () => {
			expect(await declarations(debug())).toEqual([
				"outline: 2px solid red",
				"outline-offset: -2px",
			]);
			expect(await declarations(debug(true))).toEqual([
				"outline: 2px solid red",
				"outline-offset: -2px",
			]);
			expect(await serialize(debug())).not.toContain("& *");
		});

		test('the "nested" form outlines the host plus every descendant through "& *"', async () => {
			let css = await serialize(debug("nested"));

			expect(css).toContain("& *");
			// Twice over: once on the host block, once inside the `& *` block.
			expect(await declarations(debug("nested"))).toEqual([
				"outline: 2px solid red",
				"outline-offset: -2px",
				"outline: 2px solid red",
				"outline-offset: -2px",
			]);
		});
	});
});
