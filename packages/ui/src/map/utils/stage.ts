/**
 * How a map's parts sit on its stage: every marker, label and route is measured in pixels from
 * the stage's middle, so one placement holds at any stage size, and the island moves a part by
 * rewriting the same two properties the server wrote.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { LngLat, Pixel } from "./mercator.js";

import { linePath } from "./basemap.js";

/** Writes a pixel length with at most one decimal. */
function px(value: number): string {
	return `${Math.round(value * 10) / 10}px`;
}

/**
 * The `left` and `top` that put a part `offset` pixels from the stage's middle.
 *
 * @example offsetStyle([12, -4]); // { left: "calc(50% + 12px)", top: "calc(50% + -4px)" }
 */
export function offsetStyle([x, y]: Pixel): { left: string; top: string } {
	return { left: `calc(50% + ${px(x)})`, top: `calc(50% + ${px(y)})` };
}

/** A CSS dashed ident from an id that may hold characters an ident cannot, for anchor names. */
export function anchorFor(id: string): string {
	return `--ui-map-${id.replace(/[^\w-]/g, "-")}`;
}

/** SVG path data for a route, each point projected to pixels from the stage's middle. */
export function routePathData(path: LngLat[], project: (point: LngLat) => Pixel): string {
	return linePath(path, (point) => project([point[0] ?? 0, point[1] ?? 0]));
}

/** Reads a route's points back from its `data-path` attribute, skipping anything malformed. */
export function readPath(value: string | null): LngLat[] {
	if (value === null) return [];
	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		return [];
	}
	if (!Array.isArray(parsed)) return [];
	return parsed.flatMap((point: unknown): LngLat[] => {
		if (!Array.isArray(point)) return [];
		let [lng, lat] = point as unknown[];
		return typeof lng === "number" && typeof lat === "number" ? [[lng, lat]] : [];
	});
}
