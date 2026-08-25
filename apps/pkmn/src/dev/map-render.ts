/**
 * Pure geometry and classification helpers for the map editor's canvas, kept as
 * plain math so the view shell stays thin and testable on its own: tile↔screen
 * conversion scales off {@link BASE_TILE_PX}, and {@link eventMarkerStyle} turns an
 * event's first page into the marker glyph, accent color, and outline flag.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EventPage, MapEvent } from "~/presentation/render/map-schema";

/** Display pixels one map tile spans at zoom 1; every screen size scales off this. */
export const BASE_TILE_PX = 16;

/** An axis-aligned rectangle in canvas pixels: top-left corner plus size. */
export interface ScreenRect {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** A tile coordinate (column, row) in map space. */
export interface TileCoord {
	/** Zero-based tile column. */
	x: number;
	/** Zero-based tile row. */
	y: number;
}

/** How the canvas should draw one event's marker: glyph, accent, and fill style. */
export interface EventMarkerStyle {
	/** The single-character badge drawn over the marker (an arrow or bullet). */
	glyph: string;
	/** The marker's accent color (border + badge background). */
	color: string;
	/**
	 * True for a page with no graphic or a non-action trigger, so the canvas draws an
	 * outlined placeholder and keeps a real sprite visible.
	 */
	invisible: boolean;
}

/** How many display pixels one tile spans at the given (already whole) zoom. */
export function tileScreenSize(zoom: number): number {
	return BASE_TILE_PX * Math.max(1, Math.trunc(zoom));
}

/**
 * The on-canvas rectangle a map tile occupies at a zoom. Pure: the view blits into
 * this rect and its tests assert the math directly.
 *
 * @param x Tile column.
 * @param y Tile row.
 * @param zoom The whole zoom factor.
 */
export function tileScreenRect(x: number, y: number, zoom: number): ScreenRect {
	let size = tileScreenSize(zoom);
	return { x: x * size, y: y * size, w: size, h: size };
}

/** The full canvas size in pixels for a `width`×`height`-tile map at a zoom. */
export function canvasSize(
	width: number,
	height: number,
	zoom: number,
): { width: number; height: number } {
	let size = tileScreenSize(zoom);
	return { width: width * size, height: height * size };
}

/**
 * Converts a pixel offset within the canvas's own bitmap to a tile coordinate, or
 * `null` when it falls outside the map. Integer math on an offset the caller has
 * already mapped into bitmap space, so CSS scaling is resolved upstream.
 *
 * @param offsetX Horizontal offset in canvas-bitmap pixels.
 * @param offsetY Vertical offset in canvas-bitmap pixels.
 * @param width Map width in tiles.
 * @param height Map height in tiles.
 * @param zoom The whole zoom factor.
 */
export function screenToTile(
	offsetX: number,
	offsetY: number,
	width: number,
	height: number,
	zoom: number,
): TileCoord | null {
	let size = tileScreenSize(zoom);
	let x = Math.floor(offsetX / size);
	let y = Math.floor(offsetY / size);
	if (x < 0 || y < 0 || x >= width || y >= height) return null;
	return { x, y };
}

/** Glyph + accent color per page trigger, shared by the marker and any legend. */
const TRIGGER_STYLE: Record<EventPage["trigger"], { glyph: string; color: string }> = {
	action: { glyph: "●", color: "rgba(129, 140, 248, 0.95)" },
	"player-touch": { glyph: "▶", color: "rgba(74, 222, 128, 0.95)" },
	"event-touch": { glyph: "◆", color: "rgba(56, 189, 248, 0.95)" },
	autorun: { glyph: "▲", color: "rgba(250, 204, 21, 0.95)" },
	parallel: { glyph: "∥", color: "rgba(244, 114, 182, 0.95)" },
};

/** The fallback marker style for an event whose page list is empty. */
const EMPTY_STYLE: EventMarkerStyle = {
	glyph: "?",
	color: "rgba(148, 163, 184, 0.95)",
	invisible: true,
};

/**
 * The marker style for one event, classified from its first page: glyph and accent
 * color from the page's `trigger`, plus an outline flag for a page with no graphic,
 * so the canvas keeps a real sprite visible under its marker.
 *
 * @param event The event to classify (its first page is the representative one).
 */
export function eventMarkerStyle(event: MapEvent): EventMarkerStyle {
	let page = event.pages[0];
	if (!page) return EMPTY_STYLE;
	let base = TRIGGER_STYLE[page.trigger];
	return {
		glyph: base.glyph,
		color: base.color,
		invisible: page.graphic === null || page.trigger !== "action",
	};
}
