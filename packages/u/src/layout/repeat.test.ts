/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { repeat } from "./repeat";

describe("repeat", () => {
	test("numeric count with a numeric track defaults to fr units", () => {
		expect(repeat(3, 1)).toBe("repeat(3, 1fr)");
	});

	test("numeric count with a fractional numeric track", () => {
		expect(repeat(2, 0.5)).toBe("repeat(2, 0.5fr)");
	});

	test("numeric count with a bare string track", () => {
		expect(repeat(3, "1fr")).toBe("repeat(3, 1fr)");
	});

	test("numeric count with a minmax() track", () => {
		expect(repeat(2, "minmax(0, 1fr)")).toBe("repeat(2, minmax(0, 1fr))");
	});

	test("auto-fit count", () => {
		expect(repeat("auto-fit", "minmax(140px, 1fr)")).toBe("repeat(auto-fit, minmax(140px, 1fr))");
	});

	test("auto-fill count", () => {
		expect(repeat("auto-fill", "minmax(min(100%, 12rem), 1fr)")).toBe(
			"repeat(auto-fill, minmax(min(100%, 12rem), 1fr))",
		);
	});
});
