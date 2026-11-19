/**
 * Checks screen-space clustering: close points gather, far ones stay apart, a point kept alone
 * never joins a group, and every input lands in exactly one group.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { centroid, clusterLabel, clusterPoints } from "./cluster.js";
import { offsetFrom } from "./mercator.js";

/** Three stays a few hundred metres apart. */
const STAYS: [number, number][] = [
	[-32, 44],
	[-31.997, 44.002],
	[-32.002, 44.001],
];

describe("clusterPoints", () => {
	test("gathers points within the radius and leaves the rest alone", () => {
		let groups = clusterPoints(
			[
				{ x: 0, y: 0 },
				{ x: 10, y: 0 },
				{ x: 200, y: 0 },
			],
			40,
		);
		expect(groups.map((group) => group.members)).toEqual([[0, 1], [2]]);
		expect(groups[0]).toMatchObject({ x: 5, y: 0 });
	});

	test("finds neighbours across grid cells", () => {
		let groups = clusterPoints(
			[
				{ x: 39, y: 39 },
				{ x: 41, y: 41 },
			],
			40,
		);
		expect(groups.map((group) => group.members)).toEqual([[0, 1]]);
	});

	test("keeps a point marked alone out of every group", () => {
		let groups = clusterPoints(
			[
				{ x: 0, y: 0, alone: true },
				{ x: 5, y: 0 },
				{ x: 8, y: 0 },
			],
			40,
		);
		expect(groups.map((group) => group.members)).toEqual([[0], [1, 2]]);
	});

	test("collapses close stays at a low zoom and separates them at a high one", () => {
		let at = (zoom: number) =>
			STAYS.map((stay) => {
				let [x, y] = offsetFrom({ center: [-32, 44], zoom }, stay);
				return { x, y };
			});
		expect(clusterPoints(at(11), 44).map((group) => group.members)).toEqual([[0, 1, 2]]);
		expect(clusterPoints(at(17), 44)).toHaveLength(3);
	});

	test("returns every input exactly once", () => {
		let points = Array.from({ length: 50 }, (_, index) => ({
			x: (index * 37) % 300,
			y: (index * 53) % 200,
		}));
		let members = clusterPoints(points, 30).flatMap((group) => group.members);
		expect([...members].sort((a, b) => a - b)).toEqual(points.map((_, index) => index));
	});
});

describe("centroid and clusterLabel", () => {
	test("averages pixels and fills the count", () => {
		expect(
			centroid([
				[0, 0],
				[10, 20],
			]),
		).toEqual([5, 10]);
		expect(clusterLabel("{count} stays", 3)).toBe("3 stays");
	});
});
