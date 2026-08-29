/**
 * Unit tests for the paired range-input lookup in
 * {@link "./paired-range-inputs"}: every assertion drives a minimal object
 * standing in for an `HTMLElement`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test, vi } from "vitest";

import { findPairedRangeInputs } from "./paired-range-inputs";

/** Builds a minimal stand-in for an `<input type="range">` element. */
function createInput(): HTMLInputElement {
	return {} as HTMLInputElement;
}

/**
 * Builds a minimal stand-in for a host `HTMLElement` whose `querySelector`
 * returns each of `results` in order, one per call.
 */
function createHost(results: (HTMLInputElement | null)[]): HTMLElement {
	let calls = 0;
	return {
		querySelector: vi.fn(() => results[calls++] ?? null),
	} as unknown as HTMLElement;
}

describe(findPairedRangeInputs.name, () => {
	test("returns both inputs keyed a and b when both are found", () => {
		let a = createInput();
		let b = createInput();
		let host = createHost([a, b]);

		let result = findPairedRangeInputs(host, "data-thumb", "min", "max");

		expect(result?.a).toBe(a);
		expect(result?.b).toBe(b);
	});

	test("returns null when the first value's input is missing", () => {
		let host = createHost([null, createInput()]);

		expect(findPairedRangeInputs(host, "data-thumb", "min", "max")).toBeNull();
	});

	test("returns null when the second value's input is missing", () => {
		let host = createHost([createInput(), null]);

		expect(findPairedRangeInputs(host, "data-thumb", "min", "max")).toBeNull();
	});

	test("returns null when both inputs are missing", () => {
		let host = createHost([null, null]);

		expect(findPairedRangeInputs(host, "data-thumb", "min", "max")).toBeNull();
	});

	test("queries with a selector combining the attribute and each value", () => {
		let selectors: string[] = [];
		let host = {
			querySelector: vi.fn((selector: string) => {
				selectors.push(selector);
				return createInput();
			}),
		} as unknown as HTMLElement;

		findPairedRangeInputs(host, "data-thumb", "min", "max");

		expect(selectors).toEqual([
			'input[type="range"][data-thumb="min"]',
			'input[type="range"][data-thumb="max"]',
		]);
	});
});
