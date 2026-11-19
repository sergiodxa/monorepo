/**
 * Web Mercator arithmetic for a map view: longitude and latitude to pixels at a zoom, pixels
 * back to longitude and latitude, and the bounds a stage of a given size shows. The server
 * render and the browser island share it, so both place every marker on the same pixel.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Width in pixels of the whole world at zoom 0, matching vector-tile renderers' 512px tiles. */
export const TILE_SIZE = 512;

/** The furthest latitude Web Mercator draws, north and south, where the square world ends. */
export const MAX_LATITUDE = 85.0511287798;

/** A point on Earth as `[longitude, latitude]` in degrees, the GeoJSON order. */
export type LngLat = [longitude: number, latitude: number];

/** A point in pixels, `[x, y]`, with `y` growing downwards. */
export type Pixel = [x: number, y: number];

/** The bounds a view shows as `[west, south, east, north]` in degrees. */
export type Bounds = [west: number, south: number, east: number, north: number];

/** Where a map looks: the point at the middle of the stage and how far in it is zoomed. */
export interface View {
	center: LngLat;
	/** Zoom level; each step doubles the scale, and fractions are allowed. */
	zoom: number;
}

/** The world's width in pixels at `zoom`. */
export function worldSize(zoom: number): number {
	return TILE_SIZE * 2 ** zoom;
}

/**
 * Projects a point to world pixels at `zoom`, measured from the world's top-left corner.
 * Latitudes past {@link MAX_LATITUDE} pin to the edge, so every input lands on the map.
 *
 * @example worldPixel([0, 0], 0); // [256, 256]
 */
export function worldPixel([longitude, latitude]: LngLat, zoom: number): Pixel {
	let size = worldSize(zoom);
	let clamped = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, latitude));
	let sine = Math.sin((clamped * Math.PI) / 180);
	let x = ((longitude + 180) / 360) * size;
	let y = (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * size;
	return [x, y];
}

/**
 * Reads world pixels at `zoom` back to a point; the inverse of {@link worldPixel}.
 *
 * @example worldLngLat([256, 256], 0); // [0, 0]
 */
export function worldLngLat([x, y]: Pixel, zoom: number): LngLat {
	let size = worldSize(zoom);
	let longitude = (x / size) * 360 - 180;
	let n = Math.PI - (2 * Math.PI * y) / size;
	let latitude = (180 / Math.PI) * Math.atan(Math.sinh(n));
	return [longitude, latitude];
}

/**
 * Pixels from the middle of a stage showing `view` to `point`, which is how every marker,
 * label and route places itself: `left: calc(50% + x px)`, at any stage size.
 *
 * @example offsetFrom({ center: [0, 0], zoom: 1 }, [90, 0]); // [256, 0]
 */
export function offsetFrom(view: View, point: LngLat): Pixel {
	let [cx, cy] = worldPixel(view.center, view.zoom);
	let [x, y] = worldPixel(point, view.zoom);
	return [x - cx, y - cy];
}

/** The point `offset` pixels away from the middle of a stage showing `view`. */
export function lngLatAt(view: View, [dx, dy]: Pixel): LngLat {
	let [cx, cy] = worldPixel(view.center, view.zoom);
	return worldLngLat([cx + dx, cy + dy], view.zoom);
}

/**
 * The bounds a stage of `size` pixels shows when it looks at `view`.
 *
 * @example viewBounds({ center: [0, 0], zoom: 1 }, [512, 512]); // [-90, -66.51…, 90, 66.51…]
 */
export function viewBounds(view: View, [width, height]: Pixel): Bounds {
	let [west, north] = lngLatAt(view, [-width / 2, -height / 2]);
	let [east, south] = lngLatAt(view, [width / 2, height / 2]);
	return [west, south, east, north];
}

/** Rounds `value` to `digits` decimals and drops a negative zero, for form fields and URLs. */
export function roundTo(value: number, digits: number): number {
	let factor = 10 ** digits;
	let rounded = Math.round(value * factor) / factor;
	return rounded === 0 ? 0 : rounded;
}

/**
 * Writes bounds the way a search form submits them: `west,south,east,north`, five decimals.
 *
 * @example formatBounds([-9.2, 38.7, -9.1, 38.8]); // "-9.2,38.7,-9.1,38.8"
 */
export function formatBounds(bounds: Bounds): string {
	return bounds.map((value) => roundTo(value, 5)).join(",");
}

/** Writes a point as `longitude,latitude` with five decimals. */
export function formatLngLat([longitude, latitude]: LngLat): string {
	return `${roundTo(longitude, 5)},${roundTo(latitude, 5)}`;
}

/** Keeps `zoom` inside `[min, max]`, reading anything that is not a number as `min`. */
export function clampZoom(zoom: number, min: number, max: number): number {
	if (!Number.isFinite(zoom)) return min;
	return Math.min(max, Math.max(min, zoom));
}
