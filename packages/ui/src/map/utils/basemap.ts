/**
 * The vector basemap a caller draws a map with: GeoJSON features sorted into land, water, parks,
 * roads and place names, turned into SVG path data for the server render and painted from the
 * same `--ui-map-*` color properties in the browser, so both look alike in light and dark.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Pixel } from "./mercator.js";

/** A GeoJSON position: longitude, latitude and an optional altitude that maps ignore. */
export type Position = number[];

/** The GeoJSON geometries a basemap draws; points become place names. */
export type MapGeometry =
	| { type: "Point"; coordinates: Position }
	| { type: "LineString"; coordinates: Position[] }
	| { type: "MultiLineString"; coordinates: Position[][] }
	| { type: "Polygon"; coordinates: Position[][] }
	| { type: "MultiPolygon"; coordinates: Position[][][] };

/** What a feature is, which decides its color and drawing order. */
export type FeatureKind = "land" | "water" | "park" | "road" | "place";

/** Properties a basemap reads from each feature. */
export type MapFeatureProperties = {
	/** Polygons default to `land`, lines to `road`, points to `place`. */
	kind?: FeatureKind;
	/** A place's name, written as a label at its point. */
	name?: string;
	/** Draws a road wider. */
	major?: boolean;
};

/** One GeoJSON feature of a basemap. */
export type MapFeature = {
	type: "Feature";
	geometry: MapGeometry;
	properties?: MapFeatureProperties | null;
};

/** The GeoJSON document a vector basemap is drawn from. */
export type MapFeatureCollection = {
	type: "FeatureCollection";
	features: MapFeature[];
};

/** The order kinds are drawn in, bottom first, so roads cross parks and water covers land. */
export const KIND_ORDER: Exclude<FeatureKind, "place">[] = ["land", "park", "water", "road"];

/**
 * The color each part of a basemap paints with: a `--ui-map-*` property a page may set, falling
 * back to a mix of the theme's page and text colors, so a basemap follows light and dark.
 */
export const BASEMAP_PAINT = {
	land: "var(--ui-map-land, color-mix(in oklab, var(--ui-bg, Canvas), var(--ui-fg, CanvasText) 3%))",
	water: "var(--ui-map-water, color-mix(in oklab, var(--ui-bg, Canvas), oklch(0.66 0.11 235) 30%))",
	park: "var(--ui-map-park, color-mix(in oklab, var(--ui-bg, Canvas), oklch(0.7 0.13 150) 24%))",
	road: "var(--ui-map-road, var(--ui-surface-raised, Canvas))",
	label: "var(--ui-map-label, var(--ui-neutral-fg-muted, GrayText))",
};

/** Stroke widths in pixels for minor and major roads, the same on the server and in the browser. */
export const ROAD_WIDTH = { minor: 3, major: 6 };

/** The kind a feature draws as, reading its geometry when it names none. */
export function featureKind(feature: MapFeature): FeatureKind {
	let kind = feature.properties?.kind;
	if (kind !== undefined) return kind;
	let type = feature.geometry.type;
	if (type === "Point") return "place";
	if (type === "LineString" || type === "MultiLineString") return "road";
	return "land";
}

/** Writes a number with at most one decimal, which is finer than a screen pixel needs. */
function short(value: number): string {
	return String(Math.round(value * 10) / 10);
}

/**
 * SVG path data through `points`, each projected to pixels; `close` ends it with `Z` for a ring.
 *
 * @example linePath([[0, 0], [1, 1]], ([x, y]) => [x * 10, y * 10]); // "M0 0L10 10"
 */
export function linePath(
	points: Position[],
	project: (point: Position) => Pixel,
	close = false,
): string {
	let d = points
		.map((point, index) => {
			let [x, y] = project(point);
			return `${index === 0 ? "M" : "L"}${short(x)} ${short(y)}`;
		})
		.join("");
	return close && d !== "" ? `${d}Z` : d;
}

/**
 * SVG path data for a line or area geometry, with every ring of a polygon closed, so holes
 * cut through under the `evenodd` fill rule. A point has no path and comes back empty.
 */
export function geometryPath(geometry: MapGeometry, project: (point: Position) => Pixel): string {
	switch (geometry.type) {
		case "LineString":
			return linePath(geometry.coordinates, project);
		case "MultiLineString":
			return geometry.coordinates.map((line) => linePath(line, project)).join("");
		case "Polygon":
			return geometry.coordinates.map((ring) => linePath(ring, project, true)).join("");
		case "MultiPolygon":
			return geometry.coordinates
				.flatMap((polygon) => polygon.map((ring) => linePath(ring, project, true)))
				.join("");
		default:
			return "";
	}
}

/** A place name to write over the basemap, read from a point feature. */
export interface PlaceLabel {
	name: string;
	at: Position;
}

/** The named point features of a basemap, the labels it writes over its shapes. */
export function placeLabels(data: MapFeatureCollection | undefined): PlaceLabel[] {
	let labels: PlaceLabel[] = [];
	for (let feature of data?.features ?? []) {
		let name = feature.properties?.name;
		if (feature.geometry.type !== "Point" || featureKind(feature) !== "place" || !name) continue;
		labels.push({ name, at: feature.geometry.coordinates });
	}
	return labels;
}
