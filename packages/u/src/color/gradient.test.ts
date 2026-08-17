/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { conicGradient, linearGradient, radialGradient } from "./gradient";

describe("linearGradient", () => {
	test("a numeric angle is treated as degrees", () => {
		expect(linearGradient(45, "red", "blue")).toBe("linear-gradient(45deg, red, blue)");
	});

	test("a string angle passes through unchanged", () => {
		expect(linearGradient("to right", "red", "blue")).toBe("linear-gradient(to right, red, blue)");
	});

	test("a stop object adds a position after the color", () => {
		expect(linearGradient("to right", { color: "red", position: "20%" }, "blue")).toBe(
			"linear-gradient(to right, red 20%, blue)",
		);
	});

	test("a stop object with no position behaves like a bare color string", () => {
		expect(linearGradient("to right", { color: "red" }, "blue")).toBe(
			"linear-gradient(to right, red, blue)",
		);
	});

	test("transparent and currentColor are accepted as stops", () => {
		expect(linearGradient("to right", "currentColor", "transparent")).toBe(
			"linear-gradient(to right, currentColor, transparent)",
		);
	});
});

describe("radialGradient", () => {
	test("the shape/position clause passes through unchanged", () => {
		expect(radialGradient("circle", "red", "blue")).toBe("radial-gradient(circle, red, blue)");
	});

	test("a compound shape-at-position clause passes through unchanged", () => {
		expect(radialGradient("circle at top left", "red", "blue")).toBe(
			"radial-gradient(circle at top left, red, blue)",
		);
	});

	test("a stop object adds a position after the color", () => {
		expect(radialGradient("circle", { color: "red", position: "20%" }, "blue")).toBe(
			"radial-gradient(circle, red 20%, blue)",
		);
	});

	test("an extent keyword passes through unchanged", () => {
		expect(radialGradient("closest-side", "red", "blue")).toBe(
			"radial-gradient(closest-side, red, blue)",
		);
	});

	test("a compound shape-extent-at-position clause passes through unchanged", () => {
		expect(radialGradient("circle closest-side at top left", "red", "blue")).toBe(
			"radial-gradient(circle closest-side at top left, red, blue)",
		);
	});
});

describe("conicGradient", () => {
	test("a numeric angle is wrapped in the from keyword", () => {
		expect(conicGradient(45, "red", "blue")).toBe("conic-gradient(from 45deg, red, blue)");
	});

	test("a string angle passes through unchanged, including a position", () => {
		expect(conicGradient("from 45deg at top left", "red", "blue")).toBe(
			"conic-gradient(from 45deg at top left, red, blue)",
		);
	});

	test("a string angle with no position also passes through unchanged", () => {
		expect(conicGradient("from 90deg", "red", "blue")).toBe(
			"conic-gradient(from 90deg, red, blue)",
		);
	});

	test("a stop object adds a position after the color", () => {
		expect(conicGradient(0, { color: "red", position: "50%" }, "blue")).toBe(
			"conic-gradient(from 0deg, red 50%, blue)",
		);
	});
});
