/**
 * Holds the countdown model to its contract without a DOM: a timed menu expires into its
 * default or first available option, a menu counts down once, and cancelling stops it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { ChoiceFrame } from "../../frames.js";

import { CountdownModel, timeoutOption } from "./countdown.js";

/** A menu with a locked first option. */
function menu(extra: Partial<ChoiceFrame> = {}): ChoiceFrame {
	return {
		type: "choice",
		id: "menu-1",
		options: [
			{ id: "fly", label: "fly", disabled: true, chosen: false },
			{ id: "walk", label: "walk", disabled: false, chosen: false },
		],
		...extra,
	} as ChoiceFrame;
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe(CountdownModel, () => {
	test("takes the default, else the first available option", () => {
		expect(timeoutOption(menu({ default: "fly" }))).toBe("fly");
		expect(timeoutOption(menu())).toBe("walk");
	});

	test("expires a timed menu once with the option it takes", () => {
		let countdown = new CountdownModel();
		let expired = vi.fn();
		countdown.addEventListener("expire", (event) => expired(event.frame.id, event.option));
		let frame = menu({ timeout: 100 });
		countdown.start(frame);
		expect(countdown.frame).toBe(frame);
		vi.advanceTimersByTime(60);
		countdown.start(frame);
		vi.advanceTimersByTime(40);
		expect(expired).toHaveBeenCalledWith("menu-1", "walk");
		expect(countdown.frame).toBeUndefined();
	});

	test("counts nothing for an untimed menu, and nothing once cancelled", () => {
		let countdown = new CountdownModel();
		let expired = vi.fn();
		countdown.addEventListener("expire", expired);
		countdown.start(menu());
		expect(countdown.frame).toBeUndefined();
		countdown.start(menu({ timeout: 50 }));
		countdown.cancel();
		vi.advanceTimersByTime(100);
		expect(expired).not.toHaveBeenCalled();
	});
});
