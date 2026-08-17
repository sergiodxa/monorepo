/**
 * Unit tests for the chart scale math in {@link "./chart-scale"}: every
 * assertion checks known inputs against known outputs, with no DOM and no
 * rendering involved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { bandScale, linearScale, pieAngles, ticks } from "./chart-scale";

describe(linearScale.name, () => {
	test("maps a value proportionally from domain to range", () => {
		let scale = linearScale([0, 100], [0, 320]);

		expect(scale(0)).toBe(0);
		expect(scale(50)).toBe(160);
		expect(scale(100)).toBe(320);
	});

	test("supports a descending range for a downward-growing axis", () => {
		let scale = linearScale([0, 10], [200, 0]);

		expect(scale(0)).toBe(200);
		expect(scale(5)).toBe(100);
		expect(scale(10)).toBe(0);
	});

	test("supports a domain that doesn't start at zero", () => {
		let scale = linearScale([10, 20], [0, 100]);

		expect(scale(10)).toBe(0);
		expect(scale(15)).toBe(50);
		expect(scale(20)).toBe(100);
	});

	test("extrapolates past the domain's bounds by default", () => {
		let scale = linearScale([0, 10], [0, 100]);

		expect(scale(15)).toBe(150);
		expect(scale(-5)).toBe(-50);
	});

	test("clamp option holds output to the range's bounds for out-of-domain input", () => {
		let scale = linearScale([0, 10], [0, 100], { clamp: true });

		expect(scale(15)).toBe(100);
		expect(scale(-5)).toBe(0);
		expect(scale(5)).toBe(50);
	});

	test("a zero-width domain maps every input to the start of the range", () => {
		let scale = linearScale([5, 5], [0, 100]);

		expect(scale(5)).toBe(0);
		expect(scale(0)).toBe(0);
		expect(scale(100)).toBe(0);
	});
});

describe(bandScale.name, () => {
	test("splits the range into equal, unpadded bands", () => {
		let scale = bandScale(["a", "b", "c"], [0, 300]);

		expect(scale.bandwidth).toBe(100);
		expect(scale.position("a")).toBe(0);
		expect(scale.position("b")).toBe(100);
		expect(scale.position("c")).toBe(200);
	});

	test("paddingInner shrinks the bandwidth and leaves a gap between bands", () => {
		let scale = bandScale(["a", "b", "c"], [0, 250], { paddingInner: 0.5 });

		// step = 250 / (3 - 0.5) = 100, bandwidth = 100 * (1 - 0.5) = 50
		expect(scale.bandwidth).toBe(50);
		expect(scale.position("a")).toBe(0);
		expect(scale.position("b")).toBe(100);
		expect(scale.position("c")).toBe(200);
	});

	test("paddingOuter insets the first and last bands from the range's edges", () => {
		let scale = bandScale(["a", "b"], [0, 100], { paddingOuter: 0.5 });

		// step = 100 / (2 - 0 + 0.5*2) = 100 / 3 = 33.333...
		expect(scale.bandwidth).toBeCloseTo(33.333, 2);
		expect(scale.position("a")).toBeCloseTo(16.667, 2);
		expect(scale.position("b")).toBeCloseTo(50, 2);
	});

	test("position returns undefined for a key outside the domain", () => {
		let scale = bandScale(["a", "b"], [0, 200]);

		expect(scale.position("z")).toBeUndefined();
	});

	test("an empty domain has zero bandwidth and resolves no positions", () => {
		let scale = bandScale([], [0, 200]);

		expect(scale.bandwidth).toBe(0);
		expect(scale.position("a")).toBeUndefined();
	});
});

describe(ticks.name, () => {
	test("generates round steps of 20 across a 0-100 domain requesting 5 ticks", () => {
		expect(ticks([0, 100], 5)).toEqual([0, 20, 40, 60, 80, 100]);
	});

	test("generates round fractional steps across a 0-1 domain", () => {
		expect(ticks([0, 1], 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
	});

	test("generates round steps of 2 across a 0-10 domain requesting 5 ticks", () => {
		expect(ticks([0, 10], 5)).toEqual([0, 2, 4, 6, 8, 10]);
	});

	test("generates whole-number steps when the domain divides evenly", () => {
		expect(ticks([0, 3], 3)).toEqual([0, 1, 2, 3]);
	});

	test("descends to match a domain given high-to-low", () => {
		expect(ticks([10, 0], 5)).toEqual([10, 8, 6, 4, 2, 0]);
	});

	test("returns the single boundary value for a zero-width domain", () => {
		expect(ticks([5, 5], 3)).toEqual([5]);
	});

	test("returns an empty array when count is zero or negative", () => {
		expect(ticks([0, 100], 0)).toEqual([]);
		expect(ticks([0, 100], -5)).toEqual([]);
	});
});

describe(pieAngles.name, () => {
	test("allocates each slice proportionally to its share of the total", () => {
		let slices = pieAngles([1, 1, 2]);

		expect(slices).toEqual([
			{ value: 1, startAngle: 0, endAngle: Math.PI / 2 },
			{ value: 1, startAngle: Math.PI / 2, endAngle: Math.PI },
			{ value: 2, startAngle: Math.PI, endAngle: Math.PI * 2 },
		]);
	});

	test("defaults to sweeping one full turn starting at angle 0", () => {
		let slices = pieAngles([1, 1]);

		expect(slices[0]?.startAngle).toBe(0);
		expect(slices[slices.length - 1]?.endAngle).toBeCloseTo(Math.PI * 2, 10);
	});

	test("startAngle and endAngle constrain the total span", () => {
		let slices = pieAngles([1, 1], { startAngle: 0, endAngle: Math.PI });

		expect(slices).toEqual([
			{ value: 1, startAngle: 0, endAngle: Math.PI / 2 },
			{ value: 1, startAngle: Math.PI / 2, endAngle: Math.PI },
		]);
	});

	test("padAngle leaves a gap between adjacent slices without touching the outer edges", () => {
		let slices = pieAngles([1, 1], { padAngle: 0.2 });
		let expectedSpan = (Math.PI * 2 - 0.2) / 2;

		expect(slices[0]?.startAngle).toBeCloseTo(0, 10);
		expect(slices[0]?.endAngle).toBeCloseTo(expectedSpan, 10);
		expect(slices[1]?.startAngle).toBeCloseTo(expectedSpan + 0.2, 10);
		expect(slices[1]?.endAngle).toBeCloseTo(Math.PI * 2, 10);
	});

	test("a negative value contributes a zero-width slice instead of an inverted one", () => {
		let slices = pieAngles([-1, 1]);

		expect(slices[0]).toEqual({ value: -1, startAngle: 0, endAngle: 0 });
		expect(slices[1]?.startAngle).toBe(0);
		expect(slices[1]?.endAngle).toBeCloseTo(Math.PI * 2, 10);
	});

	test("an all-zero set of values splits the span evenly instead of collapsing", () => {
		let slices = pieAngles([0, 0, 0]);

		expect(slices[0]?.endAngle).toBeCloseTo((Math.PI * 2) / 3, 10);
		expect(slices[1]?.endAngle).toBeCloseTo((Math.PI * 4) / 3, 10);
		expect(slices[2]?.endAngle).toBeCloseTo(Math.PI * 2, 10);
	});

	test("a single value spans the full range with no pad applied", () => {
		let slices = pieAngles([5], { padAngle: 0.5 });

		expect(slices).toEqual([{ value: 5, startAngle: 0, endAngle: Math.PI * 2 }]);
	});

	test("returns an empty array for no values", () => {
		expect(pieAngles([])).toEqual([]);
	});
});
