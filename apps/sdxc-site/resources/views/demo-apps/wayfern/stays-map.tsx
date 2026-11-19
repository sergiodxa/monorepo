/**
 * The map results, wishlists and a listing share: São Miguel on OpenFreeMap's real streets, a
 * price pin per stay with a card on hover, and "Search this area".
 * It renders on the server with links for zooming, then pans and zooms once its island loads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { GeoMap } from "@sdxc/ui/map/map";
import { MapCanvasSync } from "@sdxc/ui/map/map-canvas";
import WORKER_URL from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

import type { Stay } from "./data";

import { photoSrc } from "./art";
import { href, typeLabel } from "./data";
import { money } from "./pricing";
import { regionView } from "./region";

/** Every word the map speaks. */
const LABELS = {
	zoomIn: "Zoom in",
	zoomOut: "Zoom out",
	reset: "Back to the start",
	locate: "Show my location",
	fullscreen: "Full screen",
	cluster: "{count} stays",
	gestureHint: "Use two fingers to move the map",
};

/** The id of the hidden form "Search this area" fills and submits. */
export const AREA_FORM = "wayfern-area";

namespace StaysMap {
	export interface Props {
		id: string;
		stays: Stay[];
		/** Each stay's pin label, such as its nightly price or a trip's total. */
		labels: Map<string, string>;
		/** The query each pin's link carries. */
		query: string;
		label: string;
		/** The place a search names, which the map starts on. */
		place?: string;
		/** Where a visitor left the map, which wins over the place. */
		camera?: { center: [number, number]; zoom: number };
		/** The stay a listing is about, raised and never clustered. */
		current?: string;
		/** Pins light their list rows on hover. Default: `true`. */
		linked?: boolean;
		/** The address a zoom link loads without script; zooming is the island's alone without it. */
		navigate?: (view: { center: [number, number]; zoom: number }) => string;
		/** Shows "Search this area", which submits {@link AREA_FORM}. */
		area?: boolean;
	}
}

/** The coast's map with a pin and a hover card per stay. */
export function StaysMap(handle: Handle<StaysMap.Props>) {
	return () => {
		let {
			area = false,
			camera,
			current,
			id,
			label,
			labels,
			linked = true,
			navigate,
			place,
			query,
			stays,
		} = handle.props;
		let view = camera ?? regionView(place);
		return (
			<div mix={[raw({ blockSize: "100%", minBlockSize: "20rem", display: "grid" })]}>
				<GeoMap
					id={id}
					label={label}
					center={view.center}
					zoom={view.zoom}
					minZoom={8}
					maxZoom={17}
					controls={["zoom", "reset", "fullscreen"]}
					navigation={navigate === undefined ? undefined : { href: navigate }}
					labels={LABELS}
					workerUrl={WORKER_URL}
					mix={[raw({ blockSize: "100%", "--ui-map-radius": "1rem" })]}
				>
					{stays.map((stay) => {
						let price = labels.get(stay.id) ?? money(stay.nightly);
						return (
							<GeoMap.Marker
								at={stay.at}
								label={price}
								href={href(query === "" ? `stay/${stay.id}` : `stay/${stay.id}?${query}`)}
								aria-label={`${stay.name}, ${price}`}
								current={stay.id === current}
								mapKey={linked ? stay.id : undefined}
							>
								<GeoMap.Popup>
									<span mix={[raw({ display: "grid", gap: "0.375rem", inlineSize: "13rem" })]}>
										<img
											src={photoSrc(stay, "outside")}
											alt=""
											width="600"
											height="400"
											loading="lazy"
											mix={[
												raw({
													display: "block",
													inlineSize: "100%",
													aspectRatio: "3 / 2",
													objectFit: "cover",
													borderRadius: "0.5rem",
													backgroundColor: stay.palette.sky,
												}),
											]}
										/>
										<strong
											mix={[raw({ fontSize: "0.9375rem", color: "var(--ui-neutral-fg-emphasis)" })]}
										>
											{stay.name}
										</strong>
										<span
											mix={[raw({ fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" })]}
										>
											{typeLabel(stay.type)} · ★ {stay.rating.toFixed(2)} · {price}
										</span>
									</span>
								</GeoMap.Popup>
							</GeoMap.Marker>
						);
					})}
					{area ? <GeoMap.Area form={AREA_FORM} label="Search this area" /> : null}
				</GeoMap>
				{linked ? <MapCanvasSync /> : null}
			</div>
		);
	};
}
