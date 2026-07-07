/**
 * Verifies the pure map-render geometry and event-marker classification without a
 * canvas: the tile→screen size/rect math scales with zoom off {@link BASE_TILE_PX},
 * {@link canvasSize} sizes the whole bitmap, {@link screenToTile} inverts the mapping
 * and rejects off-map offsets, and {@link eventMarkerStyle} picks the right glyph,
 * color, and "invisible" flag from the event's first page trigger and graphic.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { EventPage, MapEvent, SpriteRef } from "~/presentation/render/map-schema";

import { defaultPage } from "./editors/event-page-editor";
import {
	BASE_TILE_PX,
	canvasSize,
	eventMarkerStyle,
	screenToTile,
	tileScreenRect,
	tileScreenSize,
} from "./map-render";

/**
 * Builds a minimal event with one page whose `trigger` and `graphic` are the fields
 * the marker classifier reads.
 */
function event(trigger: EventPage["trigger"], graphic: SpriteRef = null): MapEvent {
	return {
		id: `${trigger}-1`,
		x: 0,
		y: 0,
		name: undefined,
		pages: [{ ...defaultPage(), trigger, graphic }],
	};
}

describe("tileScreenSize", () => {
	test("scales the base tile size by a whole zoom factor", () => {
		expect(tileScreenSize(1)).toBe(BASE_TILE_PX);
		expect(tileScreenSize(3)).toBe(BASE_TILE_PX * 3);
	});

	test("treats a fractional or sub-1 zoom as at least 1x whole steps", () => {
		expect(tileScreenSize(2.9)).toBe(BASE_TILE_PX * 2);
		expect(tileScreenSize(0)).toBe(BASE_TILE_PX);
	});
});

describe("tileScreenRect", () => {
	test("places a tile at its zoomed pixel origin with a square size", () => {
		let rect = tileScreenRect(3, 2, 2);
		let size = BASE_TILE_PX * 2;
		expect(rect).toEqual({ x: 3 * size, y: 2 * size, w: size, h: size });
	});

	test("the origin tile sits at (0,0)", () => {
		expect(tileScreenRect(0, 0, 4)).toEqual({
			x: 0,
			y: 0,
			w: BASE_TILE_PX * 4,
			h: BASE_TILE_PX * 4,
		});
	});
});

describe("canvasSize", () => {
	test("multiplies the tile count by the zoomed tile size", () => {
		expect(canvasSize(10, 8, 2)).toEqual({
			width: 10 * BASE_TILE_PX * 2,
			height: 8 * BASE_TILE_PX * 2,
		});
	});
});

describe("screenToTile", () => {
	test("inverts tileScreenRect for an in-bounds offset", () => {
		let zoom = 3;
		let rect = tileScreenRect(4, 5, zoom);
		// A point anywhere inside the tile maps back to that tile.
		expect(screenToTile(rect.x + 2, rect.y + 2, 10, 10, zoom)).toEqual({ x: 4, y: 5 });
	});

	test("floors to the containing tile", () => {
		let size = tileScreenSize(2);
		expect(screenToTile(size * 1 + size - 1, 0, 8, 8, 2)).toEqual({ x: 1, y: 0 });
	});

	test("returns null for offsets past the map bounds", () => {
		let zoom = 2;
		expect(screenToTile(-1, 0, 5, 5, zoom)).toBeNull();
		expect(screenToTile(0, -1, 5, 5, zoom)).toBeNull();
		let past = tileScreenSize(zoom) * 5;
		expect(screenToTile(past, 0, 5, 5, zoom)).toBeNull();
		expect(screenToTile(0, past, 5, 5, zoom)).toBeNull();
	});
});

describe("eventMarkerStyle", () => {
	test("an action-trigger page with a graphic is a solid marker", () => {
		let style = eventMarkerStyle(event("action", { image: "hero", x: 0, y: 0, w: 16, h: 16 }));
		expect(style.glyph).toBe("●");
		expect(style.invisible).toBe(false);
	});

	test("an action page without a graphic is drawn as an invisible placeholder", () => {
		expect(eventMarkerStyle(event("action", null)).invisible).toBe(true);
	});

	test("a player-touch page carries the ▶ glyph", () => {
		let style = eventMarkerStyle(event("player-touch"));
		expect(style.glyph).toBe("▶");
	});

	test("a non-action trigger is always invisible regardless of graphic", () => {
		let withGraphic = eventMarkerStyle(event("autorun", { image: "x", x: 0, y: 0, w: 8, h: 8 }));
		expect(withGraphic.glyph).toBe("▲");
		expect(withGraphic.invisible).toBe(true);
	});

	test("each trigger gets a distinct accent color", () => {
		let colors = new Set(
			(["action", "player-touch", "event-touch", "autorun", "parallel"] as const).map(
				(trigger) => eventMarkerStyle(event(trigger)).color,
			),
		);
		expect(colors.size).toBe(5);
	});

	test("an event with no pages falls back to a neutral placeholder", () => {
		let style = eventMarkerStyle({ id: "x", x: 0, y: 0, name: undefined, pages: [] });
		expect(style.invisible).toBe(true);
		expect(style.glyph).toBe("?");
	});
});
