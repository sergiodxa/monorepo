/**
 * Pure SVG path-string builders for chart geometry: {@link linePath} for a
 * connected polyline through a series of points, {@link areaPath} for the
 * same line closed down to a baseline, and {@link arcPath} for a pie or
 * donut wedge. Every builder takes coordinates already scaled to pixels —
 * mapping a data value onto a pixel position is a separate concern the
 * caller owns — so a chart component's render function is the only caller,
 * feeding these functions whatever pixel coordinates it already computed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Point } from "./geometry";

import { FULL_TURN_RADIANS } from "./full-turn-radians";
import { roundChannel } from "./round-precision";

export type { Point };

/**
 * Builds the `d` attribute for a connected polyline through `points`: a
 * single move-to for the first point, followed by one line-to per remaining
 * point, in the order given. Backs a line chart's plotted series.
 *
 * @param points Already-scaled pixel positions to connect, in draw order.
 * @returns An SVG path `d` string, or an empty string when `points` is empty.
 * @example
 * linePath([{ x: 0, y: 10 }, { x: 20, y: 0 }]);
 * // "M 0,10 L 20,0"
 */
export function linePath(points: readonly Point[]): string {
	if (points.length === 0) return "";

	return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x},${point.y}`).join(" ");
}

/**
 * Builds the `d` attribute for the line {@link linePath} draws, closed into
 * a filled region down to `baselineY`, for an area chart's filled series.
 *
 * @param points Already-scaled pixel positions along the top edge of the area, in draw order.
 * @param baselineY Pixel `y` position the area closes down (or up) to — typically the zero line or the chart's floor.
 * @returns An SVG path `d` string, or an empty string when `points` is empty.
 * @example
 * areaPath([{ x: 0, y: 10 }, { x: 20, y: 0 }], 30);
 * // "M 0,10 L 20,0 L 20,30 L 0,30 Z"
 */
export function areaPath(points: readonly Point[], baselineY: number): string {
	let first = points[0];

	if (first === undefined) return "";

	let last = points[points.length - 1] ?? first;
	let top = points
		.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x},${point.y}`)
		.join(" ");

	return `${top} L ${last.x},${baselineY} L ${first.x},${baselineY} Z`;
}

/**
 * Options accepted by {@link arcPath}.
 */
export namespace ArcPath {
	export interface Options {
		/** Horizontal pixel position of the circle's center. */
		cx: number;
		/** Vertical pixel position of the circle's center. */
		cy: number;
		/**
		 * Pixel distance from the center to the wedge's inner edge. Omit or pass
		 * `0` for a solid pie wedge reaching the center; a positive value
		 * produces a donut segment with a hole.
		 *
		 * @default `0`
		 */
		innerRadius?: number;
		/** Pixel distance from the center to the wedge's outer edge. */
		outerRadius: number;
		/**
		 * Angle, in radians, where the wedge starts. `0` points straight up (12
		 * o'clock) with positive angles sweeping clockwise, the convention a
		 * pie chart's slice allocation already produces.
		 */
		startAngle: number;
		/**
		 * Angle, in radians, where the wedge ends, measured on the same
		 * clockwise-from-12-o'clock scale as `startAngle`. Must be greater than
		 * `startAngle` — the wedge sweeps clockwise from start to end.
		 */
		endAngle: number;
	}
}

/** Fallback inner radius for {@link arcPath} — a solid wedge reaching the center. */
const DEFAULT_INNER_RADIUS = 0;

/**
 * Tolerance for treating a sweep as a full turn: trigonometric round-off
 * rarely lands a full-circle sweep exactly on {@link FULL_TURN_RADIANS}, so
 * anything within (or past) this tolerance clamps to one full turn.
 */
const FULL_TURN_EPSILON = 1e-6;

/**
 * Decimal places kept on every computed coordinate: coarse enough to round
 * away the floating-point noise `Math.sin`/`Math.cos` leave on "clean"
 * angles, yet finer than a screen pixel, so output stays exact.
 */
const COORDINATE_PRECISION = 6;

/**
 * Locates the point at `angle` (radians, clockwise from 12 o'clock) on the
 * circle centered at `(cx, cy)` with the given `radius`, rounding away
 * trigonometric floating-point noise.
 */
function pointOnCircle(cx: number, cy: number, radius: number, angle: number): Point {
	return {
		x: roundChannel(cx + radius * Math.sin(angle), COORDINATE_PRECISION),
		y: roundChannel(cy - radius * Math.cos(angle), COORDINATE_PRECISION),
	};
}

/**
 * Builds a complete circle as two 180° arcs (top-to-bottom, then back): a
 * single `A` command can't sweep a full turn since coincident start/end
 * points render as nothing, so a full turn always uses this two-arc form.
 */
function fullCirclePath(cx: number, cy: number, radius: number, sweepFlag: 0 | 1): string {
	let top = pointOnCircle(cx, cy, radius, 0);
	let bottom = pointOnCircle(cx, cy, radius, Math.PI);

	return `M ${top.x},${top.y} A ${radius} ${radius} 0 1 ${sweepFlag} ${bottom.x},${bottom.y} A ${radius} ${radius} 0 1 ${sweepFlag} ${top.x},${top.y} Z`;
}

/**
 * Builds the `d` attribute for a pie or donut wedge spanning `startAngle`
 * to `endAngle`, solid when `innerRadius` is `0` and a donut segment
 * otherwise. A full-turn (or larger) sweep renders as a full ring or disc.
 *
 * @param options Center, radii, and the clockwise angle span the wedge covers.
 * @returns An SVG path `d` string, or an empty string when `outerRadius` or the angle span is zero or negative.
 * @example
 * arcPath({ cx: 0, cy: 0, outerRadius: 10, startAngle: 0, endAngle: Math.PI / 2 });
 * // "M 0,0 L 0,-10 A 10 10 0 0 1 10,0 Z"
 * @example
 * arcPath({ cx: 0, cy: 0, innerRadius: 5, outerRadius: 10, startAngle: 0, endAngle: Math.PI / 2 });
 * // "M 0,-5 L 0,-10 A 10 10 0 0 1 10,0 L 5,0 A 5 5 0 0 0 0,-5 Z"
 */
export function arcPath(options: ArcPath.Options): string {
	let { cx, cy, outerRadius, startAngle, endAngle } = options;
	let innerRadius = Math.max(0, options.innerRadius ?? DEFAULT_INNER_RADIUS);
	let sweep = endAngle - startAngle;

	if (outerRadius <= 0 || sweep <= 0) return "";

	if (sweep >= FULL_TURN_RADIANS - FULL_TURN_EPSILON) {
		let outer = fullCirclePath(cx, cy, outerRadius, 1);

		if (innerRadius <= 0) return outer;

		return `${outer} ${fullCirclePath(cx, cy, innerRadius, 0)}`;
	}

	let largeArcFlag = sweep > Math.PI ? 1 : 0;
	let outerStart = pointOnCircle(cx, cy, outerRadius, startAngle);
	let outerEnd = pointOnCircle(cx, cy, outerRadius, endAngle);

	if (innerRadius <= 0) {
		return `M ${cx},${cy} L ${outerStart.x},${outerStart.y} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x},${outerEnd.y} Z`;
	}

	let innerStart = pointOnCircle(cx, cy, innerRadius, startAngle);
	let innerEnd = pointOnCircle(cx, cy, innerRadius, endAngle);

	return `M ${innerStart.x},${innerStart.y} L ${outerStart.x},${outerStart.y} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x},${outerEnd.y} L ${innerEnd.x},${innerEnd.y} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x},${innerStart.y} Z`;
}
