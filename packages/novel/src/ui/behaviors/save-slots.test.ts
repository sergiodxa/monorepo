/**
 * Holds the save-slots model to its contract without a DOM: slot names, writing a slot with a
 * `change`, and adopting the app's stored saves silently.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test, vi } from "vitest";

import type { GameState } from "../../frames.js";

import { QUICK_SLOT, SaveSlots } from "./save-slots.js";

/** A stand-in save; the model only stores it. */
const STATE = { position: { scene: "s", line: "l" } } as unknown as GameState;

describe(SaveSlots, () => {
	test("names the quick slot, then the numbered ones", () => {
		expect(SaveSlots.names(2)).toEqual([QUICK_SLOT, "1", "2"]);
	});

	test("writes a slot with a change, and adopts stored saves without one", () => {
		let slots = new SaveSlots({ "1": STATE });
		let changed = vi.fn();
		slots.addEventListener("change", changed);
		expect(slots.get("1")).toBe(STATE);
		slots.put(QUICK_SLOT, STATE);
		expect(slots.all).toEqual({ "1": STATE, quick: STATE });
		slots.replace(undefined);
		expect(slots.get("1")).toBeUndefined();
		expect(changed).toHaveBeenCalledOnce();
	});
});
