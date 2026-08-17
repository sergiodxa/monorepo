/**
 * Unit tests for the shared hue spectrum in {@link "./hue-spectrum"}: every
 * assertion checks the exported string's shape directly, with no DOM and no
 * rendering involved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { HUE_GRADIENT_STOPS } from "./hue-spectrum";

describe("HUE_GRADIENT_STOPS", () => {
	test("holds exactly seven comma-separated stops", () => {
		let stops = HUE_GRADIENT_STOPS.split(", ");

		expect(stops).toHaveLength(7);
	});

	test("sweeps 0 through 360 in even sixty-degree steps", () => {
		let stops = HUE_GRADIENT_STOPS.split(", ");
		let hues = stops.map((stop) => Number(/^hsl\((\d+) /.exec(stop)?.[1]));

		expect(hues).toEqual([0, 60, 120, 180, 240, 300, 360]);
	});

	test("starts and ends on the same hue, red, closing the sweep", () => {
		let stops = HUE_GRADIENT_STOPS.split(", ");

		expect(stops[0]).toBe("hsl(0 100% 50%)");
		expect(stops[stops.length - 1]).toBe("hsl(360 100% 50%)");
	});

	test("holds every stop at full saturation and mid lightness", () => {
		let stops = HUE_GRADIENT_STOPS.split(", ");

		for (let stop of stops) {
			expect(stop).toMatch(/^hsl\(\d+ 100% 50%\)$/);
		}
	});
});
