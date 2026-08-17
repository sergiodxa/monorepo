/**
 * Unit tests for {@link linePath}, {@link areaPath}, and {@link arcPath}
 * against known inputs and their exact expected SVG path-string output.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { arcPath, areaPath, linePath } from "./chart-path";

describe(linePath.name, () => {
	test("returns an empty string for no points", () => {
		expect(linePath([])).toBe("");
	});

	test("draws a single move-to for one point", () => {
		expect(linePath([{ x: 5, y: 10 }])).toBe("M 5,10");
	});

	test("draws a move-to followed by a line-to per remaining point", () => {
		let points = [
			{ x: 0, y: 10 },
			{ x: 20, y: 0 },
			{ x: 40, y: 5 },
		];

		expect(linePath(points)).toBe("M 0,10 L 20,0 L 40,5");
	});

	test("preserves negative and fractional coordinates exactly", () => {
		let points = [
			{ x: -10.5, y: 2.25 },
			{ x: 3.1, y: -4 },
		];

		expect(linePath(points)).toBe("M -10.5,2.25 L 3.1,-4");
	});
});

describe(areaPath.name, () => {
	test("returns an empty string for no points", () => {
		expect(areaPath([], 30)).toBe("");
	});

	test("closes a single point down to the baseline", () => {
		expect(areaPath([{ x: 5, y: 10 }], 30)).toBe("M 5,10 L 5,30 L 5,30 Z");
	});

	test("draws the top line then closes down to the baseline at both ends", () => {
		let points = [
			{ x: 0, y: 10 },
			{ x: 20, y: 0 },
		];

		expect(areaPath(points, 30)).toBe("M 0,10 L 20,0 L 20,30 L 0,30 Z");
	});

	test("supports a baseline above the line (closing upward)", () => {
		let points = [
			{ x: 0, y: 20 },
			{ x: 20, y: 30 },
		];

		expect(areaPath(points, 0)).toBe("M 0,20 L 20,30 L 20,0 L 0,0 Z");
	});

	test("draws through every interior point before closing", () => {
		let points = [
			{ x: 0, y: 10 },
			{ x: 10, y: 5 },
			{ x: 20, y: 0 },
		];

		expect(areaPath(points, 30)).toBe("M 0,10 L 10,5 L 20,0 L 20,30 L 0,30 Z");
	});
});

describe(arcPath.name, () => {
	test("returns an empty string when the angle span is zero", () => {
		expect(arcPath({ cx: 0, cy: 0, outerRadius: 10, startAngle: 0, endAngle: 0 })).toBe("");
	});

	test("returns an empty string when endAngle is before startAngle", () => {
		let options = { cx: 0, cy: 0, outerRadius: 10, startAngle: 1, endAngle: 0 };

		expect(arcPath(options)).toBe("");
	});

	test("returns an empty string when outerRadius is zero or negative", () => {
		expect(arcPath({ cx: 0, cy: 0, outerRadius: 0, startAngle: 0, endAngle: 1 })).toBe("");
		expect(arcPath({ cx: 0, cy: 0, outerRadius: -5, startAngle: 0, endAngle: 1 })).toBe("");
	});

	test("draws a solid quarter wedge from the center", () => {
		let options = { cx: 0, cy: 0, outerRadius: 10, startAngle: 0, endAngle: Math.PI / 2 };

		expect(arcPath(options)).toBe("M 0,0 L 0,-10 A 10 10 0 0 1 10,0 Z");
	});

	test("draws a solid half wedge with the large-arc flag still unset at exactly 180°", () => {
		let options = { cx: 0, cy: 0, outerRadius: 10, startAngle: 0, endAngle: Math.PI };

		expect(arcPath(options)).toBe("M 0,0 L 0,-10 A 10 10 0 0 1 0,10 Z");
	});

	test("sets the large-arc flag once the sweep passes 180°", () => {
		let options = { cx: 0, cy: 0, outerRadius: 10, startAngle: 0, endAngle: (3 * Math.PI) / 2 };

		expect(arcPath(options)).toBe("M 0,0 L 0,-10 A 10 10 0 1 1 -10,0 Z");
	});

	test("offsets a wedge to a non-origin center", () => {
		let options = { cx: 100, cy: 50, outerRadius: 20, startAngle: 0, endAngle: Math.PI };

		expect(arcPath(options)).toBe("M 100,50 L 100,30 A 20 20 0 0 1 100,70 Z");
	});

	test("draws a donut segment between two radii", () => {
		let options = {
			cx: 0,
			cy: 0,
			innerRadius: 5,
			outerRadius: 10,
			startAngle: 0,
			endAngle: Math.PI / 2,
		};

		expect(arcPath(options)).toBe("M 0,-5 L 0,-10 A 10 10 0 0 1 10,0 L 5,0 A 5 5 0 0 0 0,-5 Z");
	});

	test("clamps a negative innerRadius to a solid wedge", () => {
		let solid = arcPath({ cx: 0, cy: 0, outerRadius: 10, startAngle: 0, endAngle: Math.PI / 2 });
		let clamped = arcPath({
			cx: 0,
			cy: 0,
			innerRadius: -5,
			outerRadius: 10,
			startAngle: 0,
			endAngle: Math.PI / 2,
		});

		expect(clamped).toBe(solid);
	});

	test("draws a complete disc for a full-turn solid wedge", () => {
		let options = { cx: 0, cy: 0, outerRadius: 10, startAngle: 0, endAngle: 2 * Math.PI };

		expect(arcPath(options)).toBe("M 0,-10 A 10 10 0 1 1 0,10 A 10 10 0 1 1 0,-10 Z");
	});

	test("draws a complete ring as two concentric circles for a full-turn donut", () => {
		let options = {
			cx: 0,
			cy: 0,
			innerRadius: 5,
			outerRadius: 10,
			startAngle: 0,
			endAngle: 2 * Math.PI,
		};

		expect(arcPath(options)).toBe(
			"M 0,-10 A 10 10 0 1 1 0,10 A 10 10 0 1 1 0,-10 Z M 0,-5 A 5 5 0 1 0 0,5 A 5 5 0 1 0 0,-5 Z",
		);
	});

	test("clamps a sweep past a full turn to the same complete disc", () => {
		let fullTurn = arcPath({ cx: 0, cy: 0, outerRadius: 10, startAngle: 0, endAngle: 2 * Math.PI });
		let overFullTurn = arcPath({
			cx: 0,
			cy: 0,
			outerRadius: 10,
			startAngle: 0,
			endAngle: 3 * Math.PI,
		});

		expect(overFullTurn).toBe(fullTurn);
	});
});
