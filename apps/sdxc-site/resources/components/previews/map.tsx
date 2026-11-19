/**
 * Live preview for `GeoMap`: an invented island in the open Atlantic, drawn from GeoJSON with
 * a lake, two roads and three towns, six nightly prices pinned over it (two close enough to
 * share a bubble), one popup card, and zoom and full-screen controls.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MapFeatureCollection } from "@sdxc/ui/map/map";

import { raw } from "@sdxc/u/general";
import { GeoMap } from "@sdxc/ui/map/map";

/** The source the page shows, matching the markup below apart from the island's shapes. */
const CODE = `<GeoMap
	id="stays-map"
	label="Stays on Ilha Nova"
	center={[-32, 44]}
	zoom={11}
	basemap={{ kind: "geojson", data: island, ground: "water" }}
	controls={["zoom", "fullscreen"]}
	labels={labels}
>
	{stays.map((stay) => (
		<GeoMap.Marker at={stay.at} label={stay.price} mapKey={stay.id} current={stay.id === selected}>
			<GeoMap.Popup>
				<StayCard stay={stay} />
			</GeoMap.Popup>
		</GeoMap.Marker>
	))}
</GeoMap>`;

/** The middle of the island. */
const CENTER: [number, number] = [-32, 44];

/** Ilha Nova: an island far from any real coast, with a lake, a coast road and a cross road. */
const ISLAND: MapFeatureCollection = {
	type: "FeatureCollection",
	features: [
		{
			type: "Feature",
			properties: { kind: "land" },
			geometry: {
				type: "Polygon",
				coordinates: [
					[
						[-32.24, 43.93],
						[-32.12, 43.88],
						[-31.95, 43.89],
						[-31.8, 43.93],
						[-31.74, 44.0],
						[-31.79, 44.07],
						[-31.92, 44.11],
						[-32.06, 44.1],
						[-32.2, 44.06],
						[-32.27, 43.99],
						[-32.24, 43.93],
					],
				],
			},
		},
		{
			type: "Feature",
			properties: { kind: "park" },
			geometry: {
				type: "Polygon",
				coordinates: [
					[
						[-32.13, 44.03],
						[-32.06, 44.02],
						[-32.05, 44.07],
						[-32.12, 44.08],
						[-32.13, 44.03],
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
						[-31.92, 44.01],
						[-31.88, 43.99],
						[-31.85, 44.02],
						[-31.88, 44.05],
						[-31.92, 44.04],
						[-31.92, 44.01],
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
					[-32.22, 43.95],
					[-32.1, 43.91],
					[-31.95, 43.92],
					[-31.81, 43.95],
					[-31.77, 44.0],
					[-31.82, 44.06],
				],
			},
		},
		{
			type: "Feature",
			properties: { kind: "road" },
			geometry: {
				type: "LineString",
				coordinates: [
					[-32.02, 43.9],
					[-32.01, 43.97],
					[-31.97, 44.03],
					[-31.95, 44.1],
				],
			},
		},
		{
			type: "Feature",
			properties: { name: "Porto Alto" },
			geometry: { type: "Point", coordinates: [-31.99, 43.935] },
		},
		{
			type: "Feature",
			properties: { name: "Vila do Lago" },
			geometry: { type: "Point", coordinates: [-31.885, 44.065] },
		},
		{
			type: "Feature",
			properties: { name: "Ponta Oeste" },
			geometry: { type: "Point", coordinates: [-32.2, 44.0] },
		},
	],
};

/** The stays pinned on the island; the first two sit close enough to share a bubble. */
const STAYS = [
	{ id: "harbour", at: [-32.02, 44.0] as [number, number], price: "$182" },
	{ id: "quay", at: [-32.012, 44.003] as [number, number], price: "$164" },
	{ id: "lake", at: [-31.9, 44.0] as [number, number], price: "$240" },
	{ id: "west", at: [-32.16, 43.97] as [number, number], price: "$95" },
	{ id: "park", at: [-32.09, 44.05] as [number, number], price: "$128" },
	{ id: "cliff", at: [-31.82, 43.97] as [number, number], price: "$310" },
];

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div
			mix={[
				raw({
					inlineSize: "100%",
					maxInlineSize: "40rem",
					blockSize: "24rem",
					marginInline: "auto",
				}),
			]}
		>
			<GeoMap
				id="preview-map"
				label="Stays on Ilha Nova"
				center={CENTER}
				zoom={11}
				basemap={{ kind: "geojson", data: ISLAND, ground: "water" }}
				controls={["zoom", "fullscreen"]}
				labels={{
					zoomIn: "Zoom in",
					zoomOut: "Zoom out",
					reset: "Back to the island",
					locate: "Show my location",
					fullscreen: "Full screen",
					cluster: "{count} stays",
					gestureHint: "Use two fingers to move the map",
				}}
			>
				{STAYS.map((stay) => (
					<GeoMap.Marker
						at={stay.at}
						label={stay.price}
						mapKey={stay.id}
						current={stay.id === "lake"}
					>
						{stay.id === "lake" ? (
							<GeoMap.Popup>
								<div mix={[raw({ padding: "0.875rem 1rem", display: "grid", gap: "0.25rem" })]}>
									<strong>Casa do Lago</strong>
									<span mix={[raw({ color: "var(--ui-neutral-fg-muted)", fontSize: "0.875rem" })]}>
										Two bedrooms by the water · sleeps four
									</span>
									<span mix={[raw({ fontWeight: "600" })]}>$240 a night</span>
								</div>
							</GeoMap.Popup>
						) : null}
					</GeoMap.Marker>
				))}
			</GeoMap>
		</div>
	),
};
