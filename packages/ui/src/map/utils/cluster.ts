/**
 * Screen-space clustering for map markers: points closer than a radius in pixels at the current
 * zoom gather into one group. The server render and the browser island run the same function,
 * so a page renders the same bubbles before and after the island takes over.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Pixel } from "./mercator.js";

/** One point to cluster, in pixels at the current zoom. */
export interface ClusterPoint {
	x: number;
	y: number;
	/** Keeps the point on its own, such as the selected marker. */
	alone?: boolean;
}

/** One group of points: the indexes of its members in input order and their mean position. */
export interface Cluster {
	members: number[];
	x: number;
	y: number;
}

/** The grid cell a pixel falls in for cells `size` pixels wide. */
function cellOf(x: number, y: number, size: number): string {
	return `${Math.floor(x / size)}:${Math.floor(y / size)}`;
}

/**
 * Groups points greedily in input order: each point not yet taken seeds a group and gathers
 * every free point within `radius` pixels of it. A grid of `radius`-wide cells keeps each
 * lookup to its nine neighbouring cells. Groups of one come back too, so every input appears
 * exactly once.
 *
 * @param points Positions in pixels at the zoom being drawn.
 * @param radius Distance in pixels under which two points share a bubble.
 * @returns The groups in the order their seeds appear.
 * @example clusterPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 200, y: 0 }], 40).map((c) => c.members); // [[0, 1], [2]]
 */
export function clusterPoints(points: ClusterPoint[], radius: number): Cluster[] {
	let size = Math.max(radius, 1);
	let grid: Record<string, number[]> = {};
	points.forEach((point, index) => {
		if (point.alone) return;
		let cell = cellOf(point.x, point.y, size);
		(grid[cell] ??= []).push(index);
	});

	let taken = new Set<number>();
	let clusters: Cluster[] = [];
	points.forEach((seed, index) => {
		if (taken.has(index)) return;
		taken.add(index);
		let members = [index];
		if (!seed.alone) {
			let column = Math.floor(seed.x / size);
			let row = Math.floor(seed.y / size);
			for (let dx = -1; dx <= 1; dx++) {
				for (let dy = -1; dy <= 1; dy++) {
					for (let other of grid[`${column + dx}:${row + dy}`] ?? []) {
						if (taken.has(other)) continue;
						let candidate = points[other]!;
						if (Math.hypot(candidate.x - seed.x, candidate.y - seed.y) > radius) continue;
						taken.add(other);
						members.push(other);
					}
				}
			}
		}
		members.sort((a, b) => a - b);
		let x = members.reduce((sum, member) => sum + points[member]!.x, 0) / members.length;
		let y = members.reduce((sum, member) => sum + points[member]!.y, 0) / members.length;
		clusters.push({ members, x, y });
	});
	return clusters;
}

/** The middle of a set of pixels, used to place a bubble or aim a zoom at its members. */
export function centroid(pixels: Pixel[]): Pixel {
	if (pixels.length === 0) return [0, 0];
	let x = pixels.reduce((sum, [px]) => sum + px, 0) / pixels.length;
	let y = pixels.reduce((sum, [, py]) => sum + py, 0) / pixels.length;
	return [x, y];
}

/**
 * Fills a label template's `{count}` placeholder, the one way bubbles name how many markers
 * they hold.
 *
 * @example clusterLabel("{count} stays", 3); // "3 stays"
 */
export function clusterLabel(template: string, count: number): string {
	return template.replaceAll("{count}", String(count));
}
