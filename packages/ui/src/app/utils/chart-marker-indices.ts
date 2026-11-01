/**
 * Shared marker-placement math behind a plotted series' accessible,
 * hoverable point markers: picking a representative, evenly spread subset of
 * a series' points instead of placing one marker per raw data point, which
 * would turn a dense series into an unusable wall of keyboard stops.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ticks } from "./chart-scale.js";

/** A point a marker can snap to; one whose `y` is `null` recorded no data and gets no marker. */
interface MarkerCandidate {
	x: number;
	y?: number | null;
}

/**
 * Finds the index of the point in `points` whose `x` value sits closest to
 * `target`, skipping points with no data and favoring the earlier point on an exact tie.
 *
 * @param points The points to search, in their own original order.
 * @param target The `x` value to find the nearest point to.
 * @returns The index into `points` of the closest match, or `-1` when no point has data.
 */
function nearestPointIndex(points: readonly MarkerCandidate[], target: number): number {
	let closestIndex = -1;
	let closestDistance = Infinity;

	for (let [index, point] of points.entries()) {
		if (point.y === null) continue;

		let distance = Math.abs(point.x - target);

		if (distance < closestDistance) {
			closestDistance = distance;
			closestIndex = index;
		}
	}

	return closestIndex;
}

/**
 * Picks which of a plotted series' points get an accessible, hoverable
 * marker by snapping evenly spread "nice" values across `xDomain` onto the
 * nearest point with data; duplicate snaps collapse into one marker.
 *
 * @param points The series' data points, in draw order along `x`.
 * @param xDomain The `[start, end]` domain {@link ticks} generates its "nice" values across.
 * @param markerCount Approximate number of markers to place.
 * @returns The deduplicated indices into `points` to render a marker for, or `[]` when no point has data.
 */
export function computeMarkerIndices(
	points: readonly MarkerCandidate[],
	xDomain: readonly [number, number],
	markerCount: number,
): number[] {
	let indices = ticks(xDomain, markerCount).map((value) => nearestPointIndex(points, value));

	return [...new Set(indices.filter((index) => index !== -1))];
}
