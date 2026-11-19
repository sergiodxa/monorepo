/**
 * The tracking screen's map: Roma and Condesa in Mexico City on real streets, the restaurant
 * and the door as pins, and the courier riding the route between them. Every route was traced
 * once along the streets a car may take, so the line never cuts through a block.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { LngLat } from "@sdxc/ui/map/map";
import type { Handle } from "remix/component";

import { HouseIcon, StoreIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { GeoMap } from "@sdxc/ui/map/map";
import WORKER_URL from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

import type { Address, Restaurant } from "./data";

import ROUTES from "./routes.json" with { type: "json" };

/** The tile host the map draws its streets from, which the app's CSP allows. */
export const MAP_HOST = "https://tiles.openfreemap.org";

/** Every word the map speaks. */
const LABELS = {
	zoomIn: "Zoom in",
	zoomOut: "Zoom out",
	reset: "Back to the whole route",
	locate: "Show my location",
	fullscreen: "Full screen",
	cluster: "{count} places",
	gestureHint: "Use two fingers to move the map",
};

/** Every traced route, by restaurant id and then address id, as the JSON holds it. */
const TRACED: Partial<Record<string, Partial<Record<string, number[][]>>>> = ROUTES;

/** The stage size the starting zoom is fitted to: a phone's 4:3 map, which a laptop's exceeds. */
const FIT_WIDTH = 340;

/** The world's width in pixels at zoom 0, as the map draws its 512-pixel tiles. */
const WORLD_TILE = 512;

/** The stage height the starting zoom is fitted to. */
const FIT_HEIGHT = 255;

/** The share of the stage the route may fill, leaving room for the pins standing over its ends. */
const FIT_SHARE = 0.62;

/**
 * The streets from a restaurant to a saved address, as longitude and latitude pairs.
 *
 * @param restaurant Where the order is picked up.
 * @param address Where it is delivered.
 * @returns The route, or a straight line between the two when none was traced.
 */
export function deliveryRoute(restaurant: Restaurant, address: Address): LngLat[] {
	let traced = TRACED[restaurant.id]?.[address.id];
	if (traced === undefined) return [[...restaurant.at], [...address.at]];
	return traced.map(([longitude = 0, latitude = 0]) => [longitude, latitude]);
}

/**
 * The centre and zoom that show a whole route with a margin, so the restaurant, the door and
 * every turn between them are on screen at first.
 *
 * @param path The route.
 */
export function routeView(path: LngLat[]): { center: LngLat; zoom: number } {
	let longitudes = path.map((point) => point[0]);
	let latitudes = path.map((point) => point[1]);
	let west = Math.min(...longitudes);
	let east = Math.max(...longitudes);
	let south = Math.min(...latitudes);
	let north = Math.max(...latitudes);
	let center: LngLat = [(west + east) / 2, (south + north) / 2];
	let cos = Math.cos((center[1] * Math.PI) / 180);
	let across = (FIT_WIDTH * FIT_SHARE) / Math.max(east - west, 0.001);
	let down = (FIT_HEIGHT * FIT_SHARE * cos) / Math.max(north - south, 0.001);
	let zoom = Math.log2((360 / WORLD_TILE) * Math.min(across, down));
	return { center, zoom: Math.min(Math.max(Math.floor(zoom * 4) / 4, 12.5), 17) };
}

/** The glyph riding the route: the courier on a bike, in a brand disc. */
function CourierGlyph() {
	return () => (
		<g>
			<circle r="13" fill="var(--ui-brand-bg-solid)" stroke="white" stroke-width="3" />
			<g
				transform="translate(-7 -7)"
				fill="none"
				stroke="white"
				stroke-width="1.8"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<circle cx="3" cy="10" r="3" />
				<circle cx="11" cy="10" r="3" />
				<path d="M3 10 6 4h4l1 6M6 4 5 2h2" />
			</g>
		</g>
	);
}

namespace DeliveryMap {
	export interface Props {
		restaurant: Restaurant;
		address: Address;
		/** The courier's place on the route, from 0 to 1. */
		courier: number;
	}
}

/**
 * The delivery map. It renders on the server as streets with the route, pins and courier
 * drawn over them, and pans and zooms once its island loads.
 */
export function DeliveryMap(handle: Handle<DeliveryMap.Props>) {
	return () => {
		let { address, courier, restaurant } = handle.props;
		let path = deliveryRoute(restaurant, address);
		let view = routeView(path);
		return (
			<GeoMap
				id="bocado-delivery-map"
				label={`Map from ${restaurant.name} to ${address.label}`}
				center={view.center}
				zoom={view.zoom}
				minZoom={12}
				maxZoom={18}
				controls={["zoom", "reset"]}
				labels={LABELS}
				workerUrl={WORKER_URL}
				mix={[
					raw({
						aspectRatio: "4 / 3",
						"--ui-map-radius": "1rem",
						"@media (min-width: 60rem)": { aspectRatio: "16 / 10" },
					}),
				]}
			>
				<GeoMap.Route path={path} progress={courier}>
					<GeoMap.RouteMarker>
						<CourierGlyph />
					</GeoMap.RouteMarker>
				</GeoMap.Route>
				<GeoMap.Marker
					at={[...restaurant.at]}
					label={<StoreIcon size={14} />}
					aria-label={restaurant.name}
				/>
				<GeoMap.Marker
					at={[...address.at]}
					label={<HouseIcon size={14} />}
					aria-label={`${address.label}, ${address.line}`}
					tone="brand"
					current
				/>
			</GeoMap>
		);
	};
}
