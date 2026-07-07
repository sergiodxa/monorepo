/**
 * Pure geometry + classification helpers for the map editor's canvas, kept DOM-free
 * so the imperative `MapCanvas` shell in `views/map.tsx` stays thin and this math is
 * unit-testable without a canvas. Two families of helpers live here:
 *
 * - Coordinate math: {@link tileScreenSize}, {@link tileScreenRect}, and
 *   {@link screenToTile} convert between map tile coordinates and the on-canvas
 *   pixels a given zoom produces. One constant, {@link BASE_TILE_PX}, sets how many
 *   display pixels one tile spans at zoom 1; everything else scales off it, so the
 *   view and its tests agree on the blit rectangle.
 * - Event markers: {@link eventMarkerStyle} classifies a {@link MapEvent} by its
 *   first page's trigger and graphic into a badge glyph, accent color, and an
 *   "invisible" flag (a page with no graphic, or a non-`action` trigger) the canvas
 *   should outline rather than fill, so the renderer draws a consistent, legible
 *   marker for every event under the RPG-Maker-XP page model.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EventPage, MapEvent } from "~/presentation/render/map-schema";

/** Display pixels one map tile spans at zoom 1; every screen size scales off this. */
export const BASE_TILE_PX = 16;

/** An axis-aligned rectangle in canvas pixels: top-left corner plus size. */
export interface ScreenRect {
	/** Left edge in canvas pixels. */
	x: number;
	/** Top edge in canvas pixels. */
	y: number;
	/** Width in canvas pixels. */
	w: number;
	/** Height in canvas pixels. */
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
	 * True when the event's active page has no graphic of its own (or fires without
	 * an action-button press) so the canvas draws an outlined placeholder rather than
	 * a solid fill, keeping real sprites unobscured.
	 */
	invisible: boolean;
}

/** How many display pixels one tile spans at the given (already whole) zoom. */
export function tileScreenSize(zoom: number): number {
	return BASE_TILE_PX * Math.max(1, Math.trunc(zoom));
}

/**
 * The on-canvas rectangle a map tile occupies at a zoom. Pure: the view blits into
 * this rect and its tests assert the math without a canvas.
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
 * `null` when it falls outside the map. Pure integer math: callers pass the offset
 * already mapped into bitmap space (accounting for any CSS scaling) plus the map
 * bounds and zoom.
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

/** The blank marker style for an event with no pages (should not happen in practice). */
const EMPTY_STYLE: EventMarkerStyle = {
	glyph: "?",
	color: "rgba(148, 163, 184, 0.95)",
	invisible: true,
};

/**
 * The marker style for one event, classified from its first page: a glyph and accent
 * color reflecting the page's `trigger`, and an "invisible" flag set when the page
 * has no graphic (or fires without an action-button press) so the canvas outlines a
 * placeholder rather than hiding a real sprite behind a solid block.
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
