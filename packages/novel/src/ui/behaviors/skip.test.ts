/**
 * Holds the skip model to its contract without a DOM: toggled and held skip, what it passes
 * through in each mode, and stopping toggled skip while held skip lasts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test, vi } from "vitest";

import type { StopFrame } from "../../frames.js";

import { SkipModel } from "./skip.js";

/** A frame of `type`, read or not. */
function frame(type: StopFrame["type"], seen = false): StopFrame {
	return { type, seen } as StopFrame;
}

describe(SkipModel, () => {
	test("is active while toggled or held, and stop() ends only the toggle", () => {
		let skip = new SkipModel();
		let changed = vi.fn();
		skip.addEventListener("change", changed);
		skip.toggle();
		skip.hold(true);
		skip.stop();
		expect(skip.toggled).toBe(false);
		expect(skip.active).toBe(true);
		skip.hold(false);
		expect(skip.active).toBe(false);
		expect(changed).toHaveBeenCalledTimes(4);
	});

	test("passes read lines and pauses, every line in all mode, and stops at menus", () => {
		let skip = new SkipModel();
		expect(skip.passes(frame("line", true), "read")).toBe(true);
		expect(skip.passes(frame("line", false), "read")).toBe(false);
		expect(skip.passes(frame("line", false), "all")).toBe(true);
		expect(skip.passes(frame("pause"), "read")).toBe(true);
		expect(skip.passes(frame("choice"), "all")).toBe(false);
		expect(skip.passes(frame("custom"), "all")).toBe(false);
	});
});
