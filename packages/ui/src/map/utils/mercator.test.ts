/**
 * Checks the Web Mercator arithmetic against known values: the world's middle, a quarter turn
 * of longitude, a latitude round trip, and the bounds a stage shows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	clampZoom,
	formatBounds,
	lngLatAt,
	offsetFrom,
	viewBounds,
	worldLngLat,
	worldPixel,
} from "./mercator.js";

describe("worldPixel", () => {
	test("puts null island at the middle of a 512px world at zoom 0", () => {
		expect(worldPixel([0, 0], 0)).toEqual([256, 256]);
	});

	test("doubles every coordinate per zoom step", () => {
		let [x, y] = worldPixel([45, 30], 3);
		let [x0, y0] = worldPixel([45, 30], 0);
		expect(x).toBeCloseTo(x0 * 8, 6);
		expect(y).toBeCloseTo(y0 * 8, 6);
	});

	test("places a known latitude where Web Mercator says", () => {
		let [, y] = worldPixel([0, 45], 0);
		let expected = (0.5 - Math.log(Math.tan(Math.PI / 4 + Math.PI / 8)) / (2 * Math.PI)) * 512;
		expect(y).toBeCloseTo(expected, 6);
	});

	test("pins latitudes past the poles' cut-off to the world's edge", () => {
		expect(worldPixel([0, 89.9], 0)[1]).toBeCloseTo(0, 3);
		expect(worldPixel([0, -89.9], 0)[1]).toBeCloseTo(512, 3);
	});

	test("reads back to the same point", () => {
		let [lng, lat] = worldLngLat(worldPixel([-9.1393, 38.7223], 12), 12);
		expect(lng).toBeCloseTo(-9.1393, 6);
		expect(lat).toBeCloseTo(38.7223, 6);
	});
});

describe("offsetFrom", () => {
	test("puts the view's center at no offset", () => {
		expect(offsetFrom({ center: [-32, 44], zoom: 11 }, [-32, 44])).toEqual([0, 0]);
	});

	test("measures a quarter turn east as a quarter of the world", () => {
		let [x, y] = offsetFrom({ center: [0, 0], zoom: 2 }, [90, 0]);
		expect(x).toBeCloseTo(512, 6);
		expect(y).toBeCloseTo(0, 6);
	});

	test("is undone by lngLatAt", () => {
		let view = { center: [-32, 44] as [number, number], zoom: 10 };
		let [lng, lat] = lngLatAt(view, offsetFrom(view, [-31.9, 44.05]));
		expect(lng).toBeCloseTo(-31.9, 6);
		expect(lat).toBeCloseTo(44.05, 6);
	});
});

describe("viewBounds", () => {
	test("spans half the world's longitudes for a 512px stage at zoom 1", () => {
		let [west, south, east, north] = viewBounds({ center: [0, 0], zoom: 1 }, [512, 512]);
		expect(west).toBeCloseTo(-90, 6);
		expect(east).toBeCloseTo(90, 6);
		expect(north).toBeCloseTo(66.5132, 3);
		expect(south).toBeCloseTo(-66.5132, 3);
	});

	test("formats bounds with five decimals", () => {
		expect(formatBounds([-9.123456789, 38.7, -9.1, 38.800004])).toBe("-9.12346,38.7,-9.1,38.8");
	});
});

describe("clampZoom", () => {
	test("keeps a zoom within its limits", () => {
		expect(clampZoom(25, 0, 20)).toBe(20);
		expect(clampZoom(-1, 2, 20)).toBe(2);
		expect(clampZoom(Number.NaN, 3, 20)).toBe(3);
	});
});
