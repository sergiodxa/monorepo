/**
 * The Lowmere coast as map data: its land, lakes, pinewood and roads as GeoJSON, placed in an
 * empty stretch of the Atlantic so no real geography shows, and the projection from the drawn
 * map's units to longitude and latitude, so a stay's pin lands where its picture says.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MapFeature, MapFeatureCollection } from "@sdxc/ui/map/map";

import { PLACES } from "./data";

/** The drawn map's box in degrees: its west and east edges, and its north and south. */
const WEST = -32.6;
const EAST = -30.0;
const NORTH = 44.9;
const SOUTH = 43.4;

/**
 * A point of the drawn region, in its `0 0 400 300` units, as `[longitude, latitude]`.
 *
 * @example toLngLat(200, 150) // [-31.3, 44.15]
 */
export function toLngLat(x: number, y: number): [number, number] {
	let lng = WEST + (x / 400) * (EAST - WEST);
	let lat = NORTH - (y / 300) * (NORTH - SOUTH);
	return [Math.round(lng * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5];
}

/** A closed ring through drawn points, as GeoJSON coordinates. */
function ring(points: Array<[number, number]>): number[][] {
	let coordinates = points.map(([x, y]) => toLngLat(x, y));
	return [...coordinates, coordinates[0]!];
}

/** An ellipse of the drawn map as a ring of sixteen points. */
function ellipse(cx: number, cy: number, rx: number, ry: number): number[][] {
	let points: Array<[number, number]> = [];
	for (let index = 0; index < 16; index++) {
		let angle = (index / 16) * Math.PI * 2;
		points.push([cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry]);
	}
	return ring(points);
}

/** A polygon feature of one kind. */
function area(kind: "land" | "water" | "park", coordinates: number[][]): MapFeature {
	return {
		type: "Feature",
		geometry: { type: "Polygon", coordinates: [coordinates] },
		properties: { kind },
	};
}

/** A road through drawn points. */
function road(points: Array<[number, number]>, major: boolean): MapFeature {
	return {
		type: "Feature",
		geometry: { type: "LineString", coordinates: points.map(([x, y]) => toLngLat(x, y)) },
		properties: { kind: "road", major },
	};
}

/** The coastline, west to east, then the land north of it to the map's top. */
const LAND: Array<[number, number]> = [
	[-80, 278],
	[30, 270],
	[90, 285],
	[160, 268],
	[230, 280],
	[270, 252],
	[330, 258],
	[360, 240],
	[385, 200],
	[370, 160],
	[382, 116],
	[480, 108],
	[480, -90],
	[-80, -90],
];

/**
 * The region as a feature collection: land on a sea ground, the three lakes, the pinewood and
 * the highland moor as parks, the coast road and its branches, and every place's name.
 */
export const REGION: MapFeatureCollection = {
	type: "FeatureCollection",
	features: [
		area("land", ring(LAND)),
		area("park", ellipse(104, 140, 62, 36)),
		area("park", ellipse(95, 52, 58, 26)),
		area("water", ellipse(192, 104, 20, 11)),
		area("water", ellipse(222, 128, 26, 13)),
		area("water", ellipse(208, 90, 11, 7)),
		road(
			[
				[20, 40],
				[70, 70],
				[110, 140],
				[150, 150],
				[200, 120],
				[260, 100],
				[320, 92],
				[335, 150],
				[310, 210],
			],
			true,
		),
		road(
			[
				[200, 120],
				[192, 190],
				[190, 245],
			],
			false,
		),
		road(
			[
				[110, 140],
				[100, 80],
				[90, 55],
			],
			false,
		),
		...PLACES.map((place): MapFeature => ({
			type: "Feature",
			geometry: { type: "Point", coordinates: toLngLat(place.x, place.y + 22) },
			properties: { kind: "place", name: place.name },
		})),
	],
};

/**
 * Where a map of a search centres and how close it zooms: on the place when there is one, on
 * the whole coast otherwise.
 *
 * @param place The searched place's id, if any.
 */
export function regionView(place: string | undefined): { center: [number, number]; zoom: number } {
	let found = PLACES.find((entry) => entry.id === place);
	if (found === undefined) return { center: toLngLat(200, 150), zoom: 7.3 };
	return { center: toLngLat(found.x, found.y), zoom: 8.7 };
}
