/**
 * Shared test fixtures for the map: an invented island in the open Atlantic with a lake, two
 * roads and two place names, plus the strings every map needs, so server and browser tests
 * draw the same stage.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { GeoMap } from "../map/map.js";
import type { MapFeatureCollection } from "../map/utils/basemap.js";

/** The middle of the invented island. */
export const ISLAND_CENTER: [number, number] = [-32, 44];

/** An island with a lake, a coastal road, a cross road and two towns. */
export const ISLAND: MapFeatureCollection = {
	type: "FeatureCollection",
	features: [
		{
			type: "Feature",
			properties: { kind: "land" },
			geometry: {
				type: "Polygon",
				coordinates: [
					[
						[-32.12, 43.95],
						[-31.9, 43.94],
						[-31.86, 44.04],
						[-31.98, 44.08],
						[-32.13, 44.04],
						[-32.12, 43.95],
					],
				],
			},
		},
		{
			type: "Feature",
			properties: { kind: "water" },
			geometry: {
				type: "Polygon",
				coordinates: [
					[
						[-32.04, 44.0],
						[-32.02, 43.99],
						[-32.01, 44.01],
						[-32.03, 44.02],
						[-32.04, 44.0],
					],
				],
			},
		},
		{
			type: "Feature",
			properties: { kind: "road", major: true },
			geometry: {
				type: "LineString",
				coordinates: [
					[-32.1, 43.97],
					[-31.95, 43.96],
					[-31.89, 44.03],
				],
			},
		},
		{
			type: "Feature",
			properties: {},
			geometry: {
				type: "LineString",
				coordinates: [
					[-32.0, 43.95],
					[-31.99, 44.07],
				],
			},
		},
		{
			type: "Feature",
			properties: { name: "Porto Alto" },
			geometry: { type: "Point", coordinates: [-31.95, 43.98] },
		},
		{
			type: "Feature",
			properties: { name: "Vila Lago" },
			geometry: { type: "Point", coordinates: [-32.06, 44.03] },
		},
	],
};

/** Every string a map needs, in English. */
export const LABELS: GeoMap.Labels = {
	zoomIn: "Zoom in",
	zoomOut: "Zoom out",
	reset: "Reset view",
	locate: "Show my location",
	fullscreen: "Full screen",
	cluster: "{count} stays",
	gestureHint: "Use two fingers to move the map",
};

/** Page URLs for a view, as a search page would build them. */
export const NAVIGATION: GeoMap.Navigation = {
	href: (view) => `/stays?center=${view.center.join(",")}&zoom=${view.zoom}`,
};
