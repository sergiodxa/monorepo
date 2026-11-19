/**
 * Renders `GeoMap` to HTML as a server would: the basemap is SVG from the GeoJSON, close
 * markers collapse into a counted bubble linking to a closer view, zoom controls are links,
 * and nothing in the markup names the client library.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { ISLAND, ISLAND_CENTER, LABELS, NAVIGATION } from "../test/map.js";

import { GeoMap, OPEN_FREE_MAP } from "./map.js";

/** Three stays a few hundred metres apart and one across the island. */
const STAYS = [
	{ id: "a", at: [-32, 44] as [number, number], price: "$120" },
	{ id: "b", at: [-31.997, 44.002] as [number, number], price: "$140" },
	{ id: "c", at: [-32.002, 44.001] as [number, number], price: "$95" },
	{ id: "d", at: [-31.9, 43.96] as [number, number], price: "$310" },
];

/** Renders the island map at `zoom` with every stay as a marker. */
function renderMap(zoom: number, current?: string) {
	return renderToString(
		<GeoMap
			id="stays"
			label="Stays on the island"
			center={ISLAND_CENTER}
			zoom={zoom}
			basemap={{ kind: "geojson", data: ISLAND, ground: "water" }}
			labels={LABELS}
			navigation={NAVIGATION}
		>
			{STAYS.map((stay) => (
				<GeoMap.Marker
					at={stay.at}
					label={stay.price}
					href={`/stays/${stay.id}`}
					mapKey={stay.id}
					current={stay.id === current}
				/>
			))}
			<GeoMap.Area form="search" label="Search this area" />
		</GeoMap>,
	);
}

describe("GeoMap on the server", () => {
	test("draws the GeoJSON basemap as SVG and never names the client library", async () => {
		let html = await renderMap(11);
		expect(html).toContain('data-slot="map-basemap"');
		expect(html).toMatch(/<path[^>]*data-kind="land"/);
		expect(html).toMatch(/<path[^>]*data-kind="water"/);
		expect(html).toMatch(/<path[^>]*data-kind="road-major"/);
		expect(html).toContain("Porto Alto");
		expect(html).toContain('role="region"');
		expect(html).toContain('aria-label="Stays on the island"');
		expect(html.toLowerCase()).not.toContain("maplibre");
	});

	test("collapses close markers into one bubble linking two zoom steps in", async () => {
		let html = await renderMap(11);
		let bubbles = [...html.matchAll(/<a[^>]*data-slot="map-cluster"[^>]*>(\d+)<\/a>/g)];
		expect(bubbles).toHaveLength(1);
		expect(bubbles[0]![1]).toBe("3");
		expect(bubbles[0]![0]).toContain('aria-label="3 stays"');
		expect(bubbles[0]![0]).toMatch(/href="\/stays\?center=[^"]*&amp;zoom=13"/);
		let hidden = [...html.matchAll(/<a[^>]*data-slot="map-marker"[^>]*>/g)].filter((match) =>
			/\shidden/.test(match[0]),
		);
		expect(hidden).toHaveLength(3);
	});

	test("separates the markers at a high zoom", async () => {
		let html = await renderMap(17);
		expect(html).not.toMatch(/<a[^>]*data-slot="map-cluster"/);
	});

	test("keeps the current marker out of its cluster", async () => {
		let html = await renderMap(11, "a");
		let bubble = /<a[^>]*data-slot="map-cluster"[^>]*>(\d+)<\/a>/.exec(html);
		expect(bubble?.[1]).toBe("2");
		expect(html).toMatch(/<a[^>]*aria-current="true"(?![^>]*\shidden)[^>]*>\$120/);
	});

	test("links the zoom controls to the next views", async () => {
		let html = await renderMap(11);
		expect(html).toMatch(
			/<a[^>]*href="\/stays\?center=-32,44&amp;zoom=12"[^>]*aria-label="Zoom in"/,
		);
		expect(html).toMatch(
			/<a[^>]*href="\/stays\?center=-32,44&amp;zoom=10"[^>]*aria-label="Zoom out"/,
		);
	});

	test("draws on OpenFreeMap's light and dark styles when no basemap is given", async () => {
		let html = await renderToString(
			<GeoMap id="plain" label="Plain" center={ISLAND_CENTER} zoom={11} labels={LABELS} />,
		);
		expect(html).toContain(OPEN_FREE_MAP.light);
		expect(html).toContain(OPEN_FREE_MAP.dark);
		expect(html).not.toMatch(/<[a-z]+[^>]*data-slot="map-basemap"/);
	});

	test("hides the zoom buttons when the map has no navigation", async () => {
		let html = await renderToString(
			<GeoMap id="plain" label="Plain" center={[0, 0]} zoom={3} labels={LABELS} />,
		);
		expect(html).toMatch(/<button[^>]*hidden[^>]*aria-label="Zoom in"/);
		expect(html).not.toContain("href=");
	});

	test("writes the search area's fields for the server's assumed viewport", async () => {
		let html = await renderMap(11);
		expect(html).toMatch(/<input[^>]*name="center"[^>]*value="-32,44"/);
		expect(html).toMatch(/<input[^>]*name="zoom"[^>]*value="11"/);
		expect(html).toMatch(
			/<input[^>]*name="bounds"[^>]*value="-32.17578,43\.\d+,-31.82422,44\.\d+"/,
		);
		expect(html).toMatch(/<button[^>]*type="submit"[^>]*form="search"[^>]*hidden/);
	});
});
