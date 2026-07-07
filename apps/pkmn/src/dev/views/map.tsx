/**
 * Map + Events tool view — an RPG-Maker-XP-style multi-map editor built on the
 * canonical tool-view pattern. The component constructs a {@link MapProject} once in
 * setup — an ordered set of maps, each its own {@link MapEditor}, with one active —
 * and drives every control through the active map; there are no framework hooks, so
 * local UI state lives in setup-scope variables and the view re-renders through
 * `handle.update()` when a control changes it. A {@link MapCanvas} DOM helper (the
 * imperative shell around the pure editor) blits the active map to a canvas and turns
 * pointer input into paint/erase/fill/event gestures; switching maps retargets it.
 *
 * The surface adds a map tree (create/select/rename/delete, active map highlighted)
 * above the per-map controls, then: resize + BGM controls, a tileset sidebar (load one
 * or more tileset images from the manifest
 * `images`/`atlases` or a URL, each sliced into a clickable tile grid — the
 * selected tile carries its tileset index), a layer/tool bar (ground/decor/
 * overhead/collision plus paint/erase/fill/event, and the collision kind when
 * editing collision), and the map canvas itself. In event mode a click places a new
 * event (one default page) or opens the {@link EventEditor} dialog on the clicked
 * one — the RPG-Maker-XP-style modal that edits its {@link MapEvent}'s name and
 * ordered {@link EventPage}s (conditions, graphic, autonomous movement, options,
 * trigger, and the recursive command list) and commits back on OK. Export POSTs the
 * active map's serialized {@link MapData} to the map export action; Export all loops
 * the project's maps through the same action so each is written and registered.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { isFailure } from "@pkg/result";
import { css, on, ref } from "remix/ui";

import manifest from "~/content/manifest.json";
import {
	EMPTY_CELL,
	type EventPage,
	type MapEvent,
	type Tileset,
	unpackTileRef,
} from "~/presentation/render/map-schema";
import { Collision, tileSourceRect } from "~/presentation/render/tilemap";

import { defaultPage, TRIGGERS } from "../editors/event-page-editor";
import {
	type CollisionKind,
	COLLISION_VALUES,
	type EditLayer,
	ellipseCells,
	MapEditor,
	MAX_ZOOM,
	MIN_ZOOM,
	type MapTool,
	normalizeRegion,
	rectCells,
	TILE_LAYERS,
	type TileLayerName,
	type TileRegion,
} from "../editors/map-editor";
import { MapProject } from "../editors/map-project";
import {
	canvasSize,
	eventMarkerStyle,
	screenToTile,
	tileScreenRect,
	tileScreenSize,
} from "../map-render";

import { EventEditor } from "./event-editor";

/** The style-object shape the `css()` mixin accepts, used for shared base styles. */
type Styles = Parameters<typeof css>[0];

/** Shared base style for the small control buttons (tools/layers/actions). */
const CONTROL_BUTTON: Styles = {
	padding: "0.4rem 0.75rem",
	fontFamily: "inherit",
	color: "#e5e7eb",
	background: "#18181b",
	border: "1px solid #3f3f46",
	borderRadius: "0.375rem",
	cursor: "pointer",
};

/** Shared base style for text/number inputs and selectors. */
const FIELD: Styles = {
	padding: "0.35rem 0.5rem",
	fontFamily: "inherit",
	color: "#e5e7eb",
	background: "#18181b",
	border: "1px solid #3f3f46",
	borderRadius: "0.375rem",
};

/** Shared style for the small labels above each control group. */
const LABEL = css({ display: "grid", gap: "0.25rem", fontSize: "0.8rem", color: "#9ca3af" });

/** Sorted list of manifest image ids the tileset picker offers. */
const IMAGE_IDS = Object.keys(
	(manifest as { images?: Record<string, string> }).images ?? {},
).sort();

/** The indigo accent the editor uses to mark the active control/selection. */
const ACCENT = "#6366f1";

/** The idle border color shared by the small control buttons. */
const IDLE_BORDER = "#3f3f46";

/** The event triggers shown in the on-canvas legend (id → human label). */
const TRIGGER_LEGEND = TRIGGERS;

/** The selectable editing layers, in bar order, with their labels. */
const EDIT_LAYERS: Array<{ id: EditLayer; label: string }> = [
	{ id: "ground", label: "Ground" },
	{ id: "decor", label: "Decor" },
	{ id: "overhead", label: "Overhead" },
	{ id: "collision", label: "Collision" },
];

/** The selectable tools, in bar order, with their labels. */
const TOOLS: Array<{ id: MapTool; label: string }> = [
	{ id: "paint", label: "Paint" },
	{ id: "erase", label: "Erase" },
	{ id: "fill", label: "Fill" },
	{ id: "rectangle", label: "Rectangle" },
	{ id: "ellipse", label: "Ellipse" },
	{ id: "select", label: "Select" },
	{ id: "event", label: "Event" },
];

/** The stroke color for a live shape-drag preview outline. */
const PREVIEW_OUTLINE = "rgba(165, 180, 252, 0.95)";

/** The translucent fill drawn inside a live shape-drag preview. */
const PREVIEW_FILL = "rgba(129, 140, 248, 0.28)";

/** The stroke color for a committed rectangular selection. */
const SELECTION_OUTLINE = "rgba(250, 204, 21, 0.95)";

/** The collision kinds, in bar order, with their labels and overlay colors. */
const COLLISION_KINDS: Array<{ id: CollisionKind; label: string; color: string }> = [
	{ id: "walkable", label: "Walkable", color: "rgba(74, 222, 128, 0.35)" },
	{ id: "solid", label: "Solid", color: "rgba(248, 113, 113, 0.45)" },
	{ id: "water", label: "Water", color: "rgba(96, 165, 250, 0.45)" },
	{ id: "ledge", label: "Ledge", color: "rgba(250, 204, 21, 0.45)" },
];

/** A loaded tileset image plus the metadata needed to slice it into tiles. */
interface LoadedTileset {
	/** The manifest image id (or URL) the tileset draws from. */
	image: string;
	/** The decoded image element the tiles are blit from. */
	element: HTMLImageElement;
	/** Number of tile columns in the sheet. */
	columns: number;
	/** Tile width in source pixels. */
	tileWidth: number;
	/** Tile height in source pixels. */
	tileHeight: number;
}

/** Resolves a manifest image id to its served URL, or returns the id unchanged. */
function resolveImageUrl(imageOrUrl: string): string {
	let images = (manifest as { images?: Record<string, string> }).images ?? {};
	return images[imageOrUrl] ?? imageOrUrl;
}

/** Loads an image element from a URL, resolving once it has decoded. */
function loadImage(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		let image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error(`Could not load image: ${url}`));
		image.src = url;
	});
}

/**
 * Canvas-backed map renderer and pointer handler — the imperative DOM shell around
 * the pure {@link MapEditor}. It blits the visible tile layers (dimming the ones that
 * are not the active editing layer) and the collision overlay from the loaded tileset
 * images, draws each event's sprite with a kind badge (outlining sprite-less triggers
 * and highlighting the selected event), previews the selected tile under the cursor,
 * and translates pointer gestures into editor mutations, calling back the view to
 * re-render after each change. All geometry runs through the pure `map-render`
 * helpers so the blit rectangles are testable without a canvas.
 */
class MapCanvas {
	/** The display canvas, or `null` before attach / after detach. */
	#canvas: HTMLCanvasElement | null = null;

	/** Whether a paint/erase drag is in progress. */
	#painting = false;

	/**
	 * The anchor tile a rectangle/ellipse/select drag started on, or `null` when no
	 * shape/selection drag is in progress. The committed layer is never touched until
	 * release; only the preview overlay reflects the in-progress drag.
	 */
	#dragStart: { x: number; y: number } | null = null;

	/** The tile currently under the pointer, or `null` when the pointer is off-canvas. */
	#hover: { x: number; y: number } | null = null;

	/**
	 * Whether the select tool is armed to stamp the clipboard on the next click. Set by
	 * {@link armPaste} when the view's Paste button is pressed; the paste previews under
	 * the cursor and commits (then disarms) on the next canvas click.
	 */
	#pasteArmed = false;

	/** The id of the currently selected event, so its marker is highlighted. */
	#selectedEventId: string | null = null;

	/** Bound pointer handlers, kept so detach removes the exact refs. */
	#onPointerDown = (event: PointerEvent) => this.#handlePointerDown(event);
	#onPointerMove = (event: PointerEvent) => this.#handlePointerMove(event);
	#onPointerLeave = () => this.#clearHover();
	#onPointerUp = () => this.#stopPainting();

	/**
	 * @param editor The pure map editor this renders and mutates.
	 * @param tilesets Loaded tileset images keyed by tileset index (view-owned).
	 * @param onChange Called after a paint/event gesture so the view re-renders.
	 * @param onPickEvent Called with an event id (or null) when event mode selects one.
	 * @param onHover Called with the hovered tile (or null) so the view shows coords.
	 * @param onSelectionChange Called after a selection or paste-arm change so the view
	 *   re-renders the Copy/Cut/Paste controls (whose enabled state tracks the editor's
	 *   selection and clipboard).
	 */
	constructor(
		private editor: MapEditor,
		private tilesets: Array<LoadedTileset | null>,
		private readonly onChange: () => void,
		private readonly onPickEvent: (id: string | null) => void,
		private readonly onHover: (tile: { x: number; y: number } | null) => void,
		private readonly onSelectionChange: () => void,
	) {}

	/** Whether the select tool is currently armed to stamp the clipboard on click. */
	get pasteArmed(): boolean {
		return this.#pasteArmed;
	}

	/**
	 * Retargets the canvas at another map's editor and its loaded tilesets (used when
	 * the map tree switches the active map). Any in-progress drag/paste/hover is
	 * dropped so a gesture started on the old map never lands on the new one, and the
	 * canvas re-renders the newly active map.
	 *
	 * @param editor The now-active map's editor to render and mutate.
	 * @param tilesets The loaded tileset images for that map (index-aligned to it).
	 */
	setEditor(editor: MapEditor, tilesets: Array<LoadedTileset | null>): void {
		this.editor = editor;
		this.tilesets = tilesets;
		this.#painting = false;
		this.#dragStart = null;
		this.#hover = null;
		this.#pasteArmed = false;
		this.render();
	}

	/**
	 * Arms (or disarms) the clipboard paste: while armed, the clipboard block previews
	 * under the cursor and the next canvas click stamps it on the active layer. Arming
	 * is a no-op when the clipboard is empty. Re-renders the preview.
	 */
	armPaste(armed: boolean): void {
		this.#pasteArmed = armed && this.editor.hasClipboard;
		this.render();
	}

	/** Replaces the loaded-tileset list (after the sidebar loads/removes one). */
	setTilesets(tilesets: Array<LoadedTileset | null>): void {
		this.tilesets = tilesets;
	}

	/** Sets which event id is highlighted on the canvas, then re-renders. */
	setSelectedEvent(id: string | null): void {
		this.#selectedEventId = id;
		this.render();
	}

	/** Binds the canvas, wires pointer listeners, and renders once. */
	attach(canvas: HTMLCanvasElement): void {
		this.#canvas = canvas;
		canvas.style.touchAction = "none";
		canvas.addEventListener("pointerdown", this.#onPointerDown);
		canvas.addEventListener("pointermove", this.#onPointerMove);
		canvas.addEventListener("pointerleave", this.#onPointerLeave);
		window.addEventListener("pointerup", this.#onPointerUp);
		this.render();
	}

	/** Releases the canvas and removes every listener. */
	detach(): void {
		let canvas = this.#canvas;
		if (canvas !== null) {
			canvas.removeEventListener("pointerdown", this.#onPointerDown);
			canvas.removeEventListener("pointermove", this.#onPointerMove);
			canvas.removeEventListener("pointerleave", this.#onPointerLeave);
		}
		window.removeEventListener("pointerup", this.#onPointerUp);
		this.#painting = false;
		this.#canvas = null;
	}

	/** Draws every visible layer, the collision overlay, event markers, and the cursor. */
	render(): void {
		if (this.#canvas === null) return;
		let context = this.#canvas.getContext("2d");
		if (context === null) return;

		let zoom = this.editor.zoom;
		let { width, height } = canvasSize(this.editor.width, this.editor.height, zoom);
		this.#canvas.width = width;
		this.#canvas.height = height;
		context.imageSmoothingEnabled = false;

		// Backdrop.
		context.fillStyle = "#0b0b0e";
		context.fillRect(0, 0, width, height);

		// Tile layers, back-to-front; hidden layers skipped, non-active ones dimmed so
		// the layer being edited stands out.
		let active = this.editor.layer;
		for (let name of TILE_LAYERS) {
			if (!this.editor.isLayerVisible(name)) continue;
			context.globalAlpha = active === "collision" || active === name ? 1 : 0.35;
			this.#drawLayer(context, name);
		}
		context.globalAlpha = 1;

		// Collision overlay when editing collision, or when the always-on toggle is set.
		if (active === "collision" || this.editor.showCollision) this.#drawCollisionOverlay(context);

		if (this.editor.showGrid) this.#drawGrid(context, width, height);

		this.#drawEvents(context);
		this.#drawCursor(context);
		this.#drawSelection(context);
		this.#drawShapePreview(context);
		this.#drawPastePreview(context);
	}

	/** Blits one tile layer's non-empty cells from their tileset images. */
	#drawLayer(context: CanvasRenderingContext2D, name: TileLayerName): void {
		let zoom = this.editor.zoom;
		let layer = this.editor.toMapData().layers[name];
		for (let index = 0; index < layer.length; index++) {
			let cell = layer[index]!;
			if (cell === EMPTY_CELL) continue;
			let { tilesetIndex, tileIndex } = unpackTileRef(cell);
			let loaded = this.tilesets[tilesetIndex] ?? null;
			let rect = tileScreenRect(
				index % this.editor.width,
				Math.floor(index / this.editor.width),
				zoom,
			);
			if (loaded === null) {
				// No image yet: draw a labeled placeholder so the cell is still visible.
				context.fillStyle = "#3f3f46";
				context.fillRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
				continue;
			}
			let source = tileSourceRect(
				{
					id: "",
					image: loaded.image,
					columns: loaded.columns,
					tileWidth: loaded.tileWidth,
					tileHeight: loaded.tileHeight,
				},
				tileIndex,
			);
			context.drawImage(
				loaded.element,
				source.x,
				source.y,
				source.w,
				source.h,
				rect.x,
				rect.y,
				rect.w,
				rect.h,
			);
		}
	}

	/** Tints each cell by its collision value (walkable cells stay clear). */
	#drawCollisionOverlay(context: CanvasRenderingContext2D): void {
		let zoom = this.editor.zoom;
		for (let y = 0; y < this.editor.height; y++) {
			for (let x = 0; x < this.editor.width; x++) {
				let value = this.editor.collisionAt(x, y);
				let kind = COLLISION_KINDS.find((entry) => COLLISION_VALUES[entry.id] === value);
				if (!kind || kind.id === "walkable") continue;
				let rect = tileScreenRect(x, y, zoom);
				context.fillStyle = kind.color;
				context.fillRect(rect.x, rect.y, rect.w, rect.h);
			}
		}
	}

	/** Strokes the per-tile grid so cells read as distinct. */
	#drawGrid(context: CanvasRenderingContext2D, width: number, height: number): void {
		let size = tileScreenSize(this.editor.zoom);
		context.strokeStyle = "rgba(255, 255, 255, 0.08)";
		context.lineWidth = 1;
		context.beginPath();
		for (let x = 0; x <= this.editor.width; x++) {
			let px = x * size + 0.5;
			context.moveTo(px, 0);
			context.lineTo(px, height);
		}
		for (let y = 0; y <= this.editor.height; y++) {
			let py = y * size + 0.5;
			context.moveTo(0, py);
			context.lineTo(width, py);
		}
		context.stroke();
	}

	/**
	 * Draws each event: its sprite (atlas region or raw image sub-rect) when set, an
	 * outlined placeholder for sprite-less events and triggers, then a kind badge in
	 * the corner. The selected event gets a bright highlight ring.
	 */
	#drawEvents(context: CanvasRenderingContext2D): void {
		let zoom = this.editor.zoom;
		let size = tileScreenSize(zoom);
		for (let event of this.editor.events) {
			let rect = tileScreenRect(event.x, event.y, zoom);
			let style = eventMarkerStyle(event);
			let drew = this.#drawEventSprite(context, event, rect);

			if (!drew) {
				// No usable sprite: an outlined tinted placeholder so the tile stays legible.
				context.fillStyle = style.invisible ? "rgba(24, 24, 27, 0.55)" : style.color;
				context.fillRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
				context.strokeStyle = style.color;
				context.lineWidth = Math.max(1, Math.floor(zoom / 2));
				if (style.invisible) context.setLineDash([Math.max(2, zoom), Math.max(2, zoom)]);
				context.strokeRect(rect.x + 1.5, rect.y + 1.5, rect.w - 3, rect.h - 3);
				context.setLineDash([]);
			}

			// Kind badge in the top-left corner.
			let badge = Math.max(8, Math.floor(size * 0.42));
			context.fillStyle = style.color;
			context.fillRect(rect.x, rect.y, badge, badge);
			context.fillStyle = "#0b1120";
			context.font = `${Math.floor(badge * 0.8)}px system-ui, sans-serif`;
			context.textAlign = "center";
			context.textBaseline = "middle";
			context.fillText(style.glyph, rect.x + badge / 2, rect.y + badge / 2 + 1);

			if (event.id === this.#selectedEventId) {
				context.strokeStyle = "#fbbf24";
				context.lineWidth = Math.max(2, Math.floor(zoom));
				context.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
			}
		}
	}

	/**
	 * Blits an event's first-page graphic into its tile rect, scaled to fill. Supports
	 * a raw image sub-rect (image id + x/y/w/h) from a loaded tileset image; an atlas
	 * region is out of scope here (atlases aren't loaded on this canvas) so those fall
	 * back to the badge placeholder. Returns whether a sprite was drawn.
	 */
	#drawEventSprite(
		context: CanvasRenderingContext2D,
		event: MapEvent,
		rect: { x: number; y: number; w: number; h: number },
	): boolean {
		let sprite = event.pages[0]?.graphic ?? null;
		if (sprite === null || !("image" in sprite)) return false;
		let loaded = this.tilesets.find((entry) => entry?.image === sprite.image) ?? null;
		if (!loaded) return false;
		context.drawImage(
			loaded.element,
			sprite.x,
			sprite.y,
			sprite.w,
			sprite.h,
			rect.x,
			rect.y,
			rect.w,
			rect.h,
		);
		return true;
	}

	/**
	 * Highlights the hovered tile: a preview of the selected tile in paint mode, or a
	 * plain outline otherwise, so the author sees where the next action lands.
	 */
	#drawCursor(context: CanvasRenderingContext2D): void {
		let hover = this.#hover;
		if (hover === null) return;
		let zoom = this.editor.zoom;
		let rect = tileScreenRect(hover.x, hover.y, zoom);

		// A ghost of the selected tile while painting a tile layer.
		if (this.editor.tool === "paint" && this.editor.layer !== "collision") {
			let selection = this.editor.selection;
			let loaded = this.tilesets[selection.tilesetIndex] ?? null;
			if (loaded !== null) {
				let source = tileSourceRect(
					{
						id: "",
						image: loaded.image,
						columns: loaded.columns,
						tileWidth: loaded.tileWidth,
						tileHeight: loaded.tileHeight,
					},
					selection.tileIndex,
				);
				context.globalAlpha = 0.6;
				context.drawImage(
					loaded.element,
					source.x,
					source.y,
					source.w,
					source.h,
					rect.x,
					rect.y,
					rect.w,
					rect.h,
				);
				context.globalAlpha = 1;
			}
		}

		context.strokeStyle = ACCENT;
		context.lineWidth = Math.max(2, Math.floor(zoom));
		context.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
	}

	/** Outlines the committed rectangular selection with a dashed marquee, if any. */
	#drawSelection(context: CanvasRenderingContext2D): void {
		let region = this.editor.selectionRegion;
		if (region === null) return;
		let zoom = this.editor.zoom;
		let dash = Math.max(2, zoom);
		context.strokeStyle = SELECTION_OUTLINE;
		context.lineWidth = Math.max(1, Math.floor(zoom / 2));
		context.setLineDash([dash, dash]);
		this.#strokeRegion(context, region);
		context.setLineDash([]);
	}

	/**
	 * While a rectangle/ellipse/select drag is in progress, previews its extent: a
	 * rectangle/ellipse tints every covered cell and outlines its bounding box; a select
	 * drag draws only the marquee outline. A no-op when no such drag is in progress. The
	 * committed layer is never touched — this is overlay only.
	 */
	#drawShapePreview(context: CanvasRenderingContext2D): void {
		let start = this.#dragStart;
		let end = this.#hover;
		if (start === null || end === null) return;
		let tool = this.editor.tool;
		if (tool !== "rectangle" && tool !== "ellipse" && tool !== "select") return;
		let zoom = this.editor.zoom;

		// Translucent fill over each covered cell (shape tools only; select is outline).
		if (tool === "rectangle" || tool === "ellipse") {
			let cells =
				tool === "ellipse"
					? ellipseCells(start.x, start.y, end.x, end.y)
					: rectCells(start.x, start.y, end.x, end.y);
			context.fillStyle = PREVIEW_FILL;
			for (let cell of cells) {
				if (!this.#inViewBounds(cell.x, cell.y)) continue;
				let rect = tileScreenRect(cell.x, cell.y, zoom);
				context.fillRect(rect.x, rect.y, rect.w, rect.h);
			}
		}

		// Bounding-box outline so the drag extent reads even for a sparse ellipse.
		context.strokeStyle = tool === "select" ? SELECTION_OUTLINE : PREVIEW_OUTLINE;
		context.lineWidth = Math.max(1, Math.floor(zoom / 2));
		this.#strokeRegion(context, normalizeRegion(start.x, start.y, end.x, end.y));
	}

	/** True when a tile coordinate is inside the map (view-side bounds check). */
	#inViewBounds(x: number, y: number): boolean {
		return x >= 0 && y >= 0 && x < this.editor.width && y < this.editor.height;
	}

	/**
	 * When the select tool is armed to paste, previews the clipboard's footprint under
	 * the cursor (its top-left corner at the hovered tile) so the author sees where the
	 * stamp will land before committing. A no-op when not armed or off-canvas.
	 */
	#drawPastePreview(context: CanvasRenderingContext2D): void {
		if (!this.#pasteArmed) return;
		let hover = this.#hover;
		let clip = this.editor.clipboardSize;
		if (hover === null || clip === null) return;
		let zoom = this.editor.zoom;
		context.fillStyle = PREVIEW_FILL;
		for (let row = 0; row < clip.height; row++) {
			for (let col = 0; col < clip.width; col++) {
				let x = hover.x + col;
				let y = hover.y + row;
				if (!this.#inViewBounds(x, y)) continue;
				let rect = tileScreenRect(x, y, zoom);
				context.fillRect(rect.x, rect.y, rect.w, rect.h);
			}
		}
		context.strokeStyle = PREVIEW_OUTLINE;
		context.lineWidth = Math.max(1, Math.floor(zoom / 2));
		this.#strokeRegion(context, { x: hover.x, y: hover.y, width: clip.width, height: clip.height });
	}

	/** Strokes a tile region's outline in canvas pixels (uses the current stroke style). */
	#strokeRegion(context: CanvasRenderingContext2D, region: TileRegion): void {
		let topLeft = tileScreenRect(region.x, region.y, this.editor.zoom);
		let size = tileScreenSize(this.editor.zoom);
		context.strokeRect(
			topLeft.x + 0.5,
			topLeft.y + 0.5,
			region.width * size - 1,
			region.height * size - 1,
		);
	}

	/** Maps a pointer event to a tile coordinate, or `null` when off-canvas. */
	#tileAt(event: PointerEvent): { x: number; y: number } | null {
		if (this.#canvas === null) return null;
		let rect = this.#canvas.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return null;
		// Map the client point into the canvas's own bitmap pixels, undoing CSS scaling.
		let scaleX = this.#canvas.width / rect.width;
		let scaleY = this.#canvas.height / rect.height;
		let offsetX = (event.clientX - rect.left) * scaleX;
		let offsetY = (event.clientY - rect.top) * scaleY;
		return screenToTile(offsetX, offsetY, this.editor.width, this.editor.height, this.editor.zoom);
	}

	/** Records the hovered tile, re-renders the cursor, and reports it to the view. */
	#updateHover(tile: { x: number; y: number } | null): void {
		let prev = this.#hover;
		let changed = prev?.x !== tile?.x || prev?.y !== tile?.y;
		this.#hover = tile;
		if (changed) {
			this.render();
			this.onHover(tile);
		}
	}

	/** Clears the hovered tile when the pointer leaves the canvas. */
	#clearHover(): void {
		if (this.#hover === null) return;
		this.#hover = null;
		this.render();
		this.onHover(null);
	}

	/** Applies the active tool to a tile without recording a drag boundary. */
	#applyAt(tile: { x: number; y: number }): void {
		let layer = this.editor.layer;
		let tool = this.editor.tool;

		if (tool === "event") {
			let existing = this.editor.eventAt(tile.x, tile.y);
			if (existing) {
				this.onPickEvent(existing.id);
			} else {
				let placed = this.editor.addEvent(tile.x, tile.y);
				this.onPickEvent(placed ? placed.id : null);
			}
			this.render();
			this.onChange();
			return;
		}

		if (layer === "collision") {
			// Erase paints walkable; paint/fill paint the selected collision kind.
			let value =
				tool === "erase" ? Collision.Walkable : COLLISION_VALUES[this.editor.collisionKind];
			if (tool === "fill") this.editor.fill("collision", tile.x, tile.y, value);
			else this.editor.paintCollision(tile.x, tile.y, value);
		} else {
			let name = layer as TileLayerName;
			if (tool === "erase") this.editor.eraseTile(name, tile.x, tile.y);
			else if (tool === "fill") this.editor.fillTile(name, tile.x, tile.y);
			else this.editor.paintTile(name, tile.x, tile.y);
		}

		this.render();
		this.onChange();
	}

	/**
	 * Begins a gesture. Paint/erase start a drag; fill/event are one-shot;
	 * rectangle/ellipse/select begin a drag rectangle that only previews until release;
	 * an armed select click stamps the clipboard instead of starting a selection.
	 */
	#handlePointerDown(event: PointerEvent): void {
		let tile = this.#tileAt(event);
		if (tile === null) return;
		let tool = this.editor.tool;

		// An armed paste stamps the clipboard at the click and disarms; no drag begins.
		if (tool === "select" && this.#pasteArmed) {
			this.editor.paste(tile.x, tile.y);
			this.#pasteArmed = false;
			this.render();
			this.onChange();
			this.onSelectionChange();
			return;
		}

		// Rectangle/ellipse/select all drag a region; capture so the release is caught
		// even if the pointer leaves the canvas, and preview without committing.
		if (tool === "rectangle" || tool === "ellipse" || tool === "select") {
			this.#dragStart = tile;
			this.#canvas?.setPointerCapture(event.pointerId);
			this.render();
			return;
		}

		if (tool === "paint" || tool === "erase") {
			this.#painting = true;
			this.#canvas?.setPointerCapture(event.pointerId);
		}
		this.#applyAt(tile);
	}

	/** Tracks the hovered tile and continues a paint/erase drag (or shape preview). */
	#handlePointerMove(event: PointerEvent): void {
		let tile = this.#tileAt(event);
		this.#updateHover(tile);
		if (this.#painting && tile !== null) this.#applyAt(tile);
	}

	/**
	 * Ends a gesture. A paint/erase drag just stops; a rectangle/ellipse drag commits
	 * the shape fill on the active layer; a select drag records the rectangular
	 * selection. The drag anchor is cleared and the view re-rendered either way.
	 */
	#stopPainting(): void {
		this.#painting = false;
		let start = this.#dragStart;
		if (start === null) return;
		this.#dragStart = null;

		// Release outside the map falls back to the last hovered in-bounds tile so a
		// drag that ends past an edge still commits its covered region.
		let end = this.#hover ?? start;
		let tool = this.editor.tool;
		if (tool === "rectangle") {
			this.editor.rectangle(start.x, start.y, end.x, end.y);
			this.render();
			this.onChange();
		} else if (tool === "ellipse") {
			this.editor.ellipse(start.x, start.y, end.x, end.y);
			this.render();
			this.onChange();
		} else if (tool === "select") {
			this.editor.select(start.x, start.y, end.x, end.y);
			this.render();
			this.onSelectionChange();
		}
	}
}

/**
 * Map + Events authoring tool. Builds a {@link MapEditor} in setup, renders the
 * new-map controls, tileset sidebar, layer/tool bar, canvas, and event panel around
 * it, and exports the authored map to `src/content/maps/<id>.json` on demand.
 *
 * @param handle Component handle used to schedule re-renders on control changes.
 * @returns The render function for the map tool.
 */
export function MapTool(handle: Handle<Record<string, never>>) {
	// The multi-map project: an ordered set of maps, each its own live editor, with one
	// active. Every editing gesture targets `project.active`, mirrored into `editor`.
	let project = new MapProject();
	let editor = project.active;

	// View-owned loaded tileset images per map id, index-aligned to that map's editor's
	// tilesets. Kept per map (not a single array) so switching maps swaps the images too
	// and a map's tiles never render against another map's declarations.
	let loadedByMap = new Map<string, Array<LoadedTileset | null>>([[project.activeMapId, []]]);

	/** The loaded-tileset list for a map id, creating an empty one on first access. */
	function loadedFor(id: string): Array<LoadedTileset | null> {
		let existing = loadedByMap.get(id);
		if (existing) return existing;
		let fresh: Array<LoadedTileset | null> = [];
		loadedByMap.set(id, fresh);
		return fresh;
	}

	// The active map's loaded images, re-pointed whenever the active map changes.
	let loaded = loadedFor(project.activeMapId);

	// Local UI state, mirrored back into the view on `handle.update()`.
	let bgm = editor.bgm;
	let newWidth = editor.width;
	let newHeight = editor.height;
	let selectedEventId: string | null = null;

	// Map-tree controls for creating a new map.
	let newMapId = "";
	let newMapWidth = editor.width;
	let newMapHeight = editor.height;

	// The tile under the pointer, mirrored into the coordinate readout.
	let hoverTile: { x: number; y: number } | null = null;

	// New-tileset controls.
	let tilesetImageChoice = IMAGE_IDS[0] ?? "";
	let tilesetUrl = "";
	let tilesetColumns = 8;

	let status = "";
	let statusIsError = false;

	let canvas = new MapCanvas(
		editor,
		loaded,
		() => void handle.update(),
		(id) => {
			selectedEventId = id;
			canvas.setSelectedEvent(id);
			void handle.update();
		},
		(tile) => {
			hoverTile = tile;
			void handle.update();
		},
		() => void handle.update(),
	);

	/**
	 * Re-points `editor`/`loaded` at the currently active map and retargets the canvas
	 * at it, dropping the previous map's transient selection/hover state. Call after any
	 * project mutation that can change the active map (new/select/rename/delete).
	 */
	function syncActiveMap() {
		editor = project.active;
		loaded = loadedFor(project.activeMapId);
		bgm = editor.bgm;
		newWidth = editor.width;
		newHeight = editor.height;
		selectedEventId = null;
		hoverTile = null;
		canvas.setEditor(editor, loaded);
		canvas.setSelectedEvent(null);
	}

	/** Reports an outcome inline and re-renders. */
	function report(message: string, isError: boolean) {
		status = message;
		statusIsError = isError;
		void handle.update();
	}

	/** Re-renders the canvas (in sync with the selected event) and the view together. */
	function refresh() {
		canvas.setSelectedEvent(selectedEventId);
		void handle.update();
	}

	/** Copies the current selection to the clipboard so it can be pasted. */
	function copySelection() {
		let block = editor.copySelection();
		if (block === null) report("Select a region first.", true);
		else report(`Copied ${block.width}×${block.height} region.`, false);
		void handle.update();
	}

	/** Cuts the current selection to the clipboard, clearing it on the active layer. */
	function cutSelection() {
		let block = editor.cutSelection();
		if (block === null) report("Select a region first.", true);
		else report(`Cut ${block.width}×${block.height} region.`, false);
		canvas.render();
		void handle.update();
	}

	/** Arms the paste tool so the next canvas click stamps the clipboard block. */
	function armPaste() {
		if (!editor.hasClipboard) {
			report("Copy or cut a region before pasting.", true);
			return;
		}
		canvas.armPaste(true);
		report("Click the map to stamp the clipboard.", false);
		void handle.update();
	}

	/** Resizes the active map, preserving content. */
	function resizeMap() {
		editor.resize(newWidth, newHeight);
		selectedEventId = null;
		report(`Resized to ${editor.width}×${editor.height}.`, false);
		refresh();
	}

	/** Adds a fresh map to the project (from the tree's id + size inputs) and selects it. */
	function addMap() {
		let result = project.newMap(newMapId, newMapWidth, newMapHeight);
		if (isFailure(result)) {
			report(result.error.message, true);
			return;
		}
		let id = result.data;
		syncActiveMap();
		newMapId = "";
		report(`Added map "${id}" (${editor.width}×${editor.height}).`, false);
		refresh();
	}

	/** Selects a map from the tree, making it the canvas/tools target. */
	function selectMap(id: string) {
		if (id === project.activeMapId) return;
		let result = project.selectMap(id);
		if (isFailure(result)) {
			report(result.error.message, true);
			return;
		}
		syncActiveMap();
		report(`Editing map "${id}".`, false);
		refresh();
	}

	/** Renames a map, re-keying its loaded images so its tiles still resolve. */
	function renameMap(oldId: string, nextId: string) {
		let result = project.renameMap(oldId, nextId);
		if (isFailure(result)) {
			report(result.error.message, true);
			return;
		}
		let id = result.data;
		if (id !== oldId) {
			// Carry the loaded images under the new key so the renamed map keeps its tiles.
			let images = loadedFor(oldId);
			loadedByMap.delete(oldId);
			loadedByMap.set(id, images);
			if (project.activeMapId === id) loaded = images;
		}
		report(`Renamed "${oldId}" → "${id}".`, false);
		refresh();
	}

	/** Deletes a map (kept ≥1), dropping its loaded images and re-syncing the active map. */
	function deleteMap(id: string) {
		let result = project.deleteMap(id);
		if (isFailure(result)) {
			report(result.error.message, true);
			return;
		}
		loadedByMap.delete(id);
		syncActiveMap();
		report(`Deleted map "${id}".`, false);
		refresh();
	}

	/** Loads a tileset image (manifest id or URL) and declares it on the editor. */
	async function addTileset() {
		let image = tilesetUrl.trim().length > 0 ? tilesetUrl.trim() : tilesetImageChoice;
		if (image.length === 0) {
			report("Choose a manifest image or enter a URL for the tileset.", true);
			return;
		}
		let columns = Math.max(1, Math.trunc(tilesetColumns));
		report("Loading tileset…", false);
		try {
			let element = await loadImage(resolveImageUrl(image));
			let declaration: Tileset = {
				id: image,
				image,
				columns,
				tileWidth: editor.tileWidth,
				tileHeight: editor.tileHeight,
			};
			let index = editor.addTileset(declaration);
			loaded[index] = {
				image,
				element,
				columns,
				tileWidth: editor.tileWidth,
				tileHeight: editor.tileHeight,
			};
			canvas.setTilesets(loaded);
			editor.selectTile(index, 0);
			tilesetUrl = "";
			report(`Loaded tileset "${image}".`, false);
			refresh();
		} catch (error) {
			report(
				`Tileset load failed: ${error instanceof Error ? error.message : String(error)}`,
				true,
			);
		}
	}

	/** Removes a tileset (and its loaded image), keeping the two lists aligned. */
	function removeTileset(index: number) {
		editor.removeTileset(index);
		loaded.splice(index, 1);
		canvas.setTilesets(loaded);
		refresh();
	}

	/** Commits the event editor dialog's edited name + pages back to the map. */
	function commitEvent(patch: { name: string | undefined; pages: EventPage[] }) {
		if (selectedEventId === null) return;
		editor.configureEvent(selectedEventId, patch);
		selectedEventId = null;
		report("Event saved.", false);
		refresh();
	}

	/** Closes the event editor dialog without saving. */
	function cancelEvent() {
		selectedEventId = null;
		refresh();
	}

	/**
	 * POSTs one serialized map to the export action, returning a short outcome line for
	 * that map. Shared by the single-map export and the export-all loop so both report
	 * identically. The map id is validated by the project's slug rules, but the server
	 * re-validates and is the authority on what actually got written.
	 *
	 * @param map The serialized map to write.
	 * @returns A `{ ok, line }` outcome describing the write or the failure.
	 */
	async function postMap(map: ReturnType<MapEditor["toMapData"]>): Promise<{
		ok: boolean;
		line: string;
	}> {
		try {
			let response = await fetch("/dev/export/map", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(map),
			});
			let data = (await response.json()) as { path?: string; url?: string; error?: string };
			if (response.ok) return { ok: true, line: `${map.id} → ${data.path}` };
			return { ok: false, line: `${map.id}: ${data.error ?? response.statusText}` };
		} catch (error) {
			return {
				ok: false,
				line: `${map.id}: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	}

	/** Serializes the active map and POSTs it to the export action. */
	async function exportMap() {
		let map = editor.toMapData();
		if (map.id.length === 0) {
			report("Enter a map id before exporting.", true);
			return;
		}
		report("Exporting…", false);
		let outcome = await postMap(map);
		report(outcome.ok ? `Wrote ${outcome.line}.` : `Export failed: ${outcome.line}`, !outcome.ok);
	}

	/**
	 * Exports every map in the project in tree order, POSTing each to the same export
	 * action so each is validated, written to `src/content/maps/<id>.json`, and
	 * registered in the manifest. Maps are attempted independently; the status line sums
	 * up how many were written and names any that failed.
	 */
	async function exportAll() {
		let ids = project.mapIds();
		report(`Exporting ${ids.length} map(s)…`, false);
		let written = 0;
		let failures: string[] = [];
		for (let id of ids) {
			let mapEditor = project.editor(id);
			if (mapEditor === null) continue;
			let outcome = await postMap(mapEditor.toMapData());
			if (outcome.ok) written++;
			else failures.push(outcome.line);
		}
		if (failures.length === 0) {
			report(`Exported all ${written} map(s).`, false);
		} else {
			report(`Exported ${written} map(s); ${failures.length} failed: ${failures.join("; ")}`, true);
		}
	}

	return () => {
		let selectedEvent = selectedEventId ? findEvent(editor, selectedEventId) : null;
		return (
			<section mix={css({ display: "grid", gap: "1rem", justifyItems: "start" })}>
				<header mix={css({ display: "grid", gap: "0.25rem" })}>
					<h2 mix={css({ margin: 0, fontSize: "1.25rem" })}>Map + Events</h2>
					<p mix={css({ margin: 0, color: "#9ca3af", fontSize: "0.85rem" })}>
						Manage several maps in one project: pick a map from the tree, compose it across the
						ground / decor / overhead layers, paint collision, place events, then export the active
						map (or all of them) to <code>src/content/maps</code> and register each in the manifest.
					</p>
				</header>

				{/* Active-map controls: resize (content-preserving) + background music. */}
				<div
					mix={css({ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" })}
				>
					<label mix={LABEL}>
						Width (tiles)
						<input
							type="number"
							min="1"
							value={String(newWidth)}
							mix={[
								css({ ...FIELD, width: "6rem" }),
								on<HTMLInputElement, "change">("change", (event) => {
									newWidth = Number((event.target as HTMLInputElement).value);
								}),
							]}
						/>
					</label>
					<label mix={LABEL}>
						Height (tiles)
						<input
							type="number"
							min="1"
							value={String(newHeight)}
							mix={[
								css({ ...FIELD, width: "6rem" }),
								on<HTMLInputElement, "change">("change", (event) => {
									newHeight = Number((event.target as HTMLInputElement).value);
								}),
							]}
						/>
					</label>
					<button
						type="button"
						title="Resize the active map, preserving its content"
						mix={[css(CONTROL_BUTTON), on<HTMLButtonElement, "click">("click", () => resizeMap())]}
					>
						Resize
					</button>
					<label mix={LABEL}>
						BGM
						<input
							type="text"
							value={bgm}
							placeholder="route-1"
							mix={[
								css({ ...FIELD, width: "8rem" }),
								on<HTMLInputElement, "input">("input", (event) => {
									bgm = (event.target as HTMLInputElement).value;
									editor.setBgm(bgm);
								}),
							]}
						/>
					</label>
				</div>

				{/* Map tree: the project's maps, plus create/select/rename/delete. */}
				<MapTreePanel
					ids={project.mapIds()}
					activeId={project.activeMapId}
					newMapId={newMapId}
					newMapWidth={newMapWidth}
					newMapHeight={newMapHeight}
					onNewMapIdInput={(value) => {
						newMapId = value;
					}}
					onNewMapWidthInput={(value) => {
						newMapWidth = value;
					}}
					onNewMapHeightInput={(value) => {
						newMapHeight = value;
					}}
					onAdd={() => addMap()}
					onSelect={(id) => selectMap(id)}
					onRename={(oldId, nextId) => renameMap(oldId, nextId)}
					onDelete={(id) => deleteMap(id)}
				/>

				{/* Layer + tool + view bar. */}
				<div
					mix={css({
						display: "flex",
						flexWrap: "wrap",
						gap: "1.25rem",
						alignItems: "flex-end",
						width: "100%",
						padding: "0.75rem 1rem",
						background: "#141417",
						border: "1px solid #27272a",
						borderRadius: "0.5rem",
					})}
				>
					<div mix={LABEL}>
						Layer
						<div mix={css({ display: "flex", gap: "0.35rem" })}>
							{EDIT_LAYERS.map((entry) => (
								<button
									key={entry.id}
									type="button"
									mix={[
										css({
											...CONTROL_BUTTON,
											borderColor: editor.layer === entry.id ? ACCENT : IDLE_BORDER,
											background: editor.layer === entry.id ? "#1e1b4b" : "#18181b",
										}),
										on<HTMLButtonElement, "click">("click", () => {
											editor.setLayer(entry.id);
											refresh();
										}),
									]}
								>
									{entry.label}
								</button>
							))}
						</div>
					</div>
					<div mix={LABEL}>
						Tool
						<div mix={css({ display: "flex", gap: "0.35rem" })}>
							{TOOLS.map((entry) => (
								<button
									key={entry.id}
									type="button"
									mix={[
										css({
											...CONTROL_BUTTON,
											borderColor: editor.tool === entry.id ? ACCENT : IDLE_BORDER,
											background: editor.tool === entry.id ? "#1e1b4b" : "#18181b",
										}),
										on<HTMLButtonElement, "click">("click", () => {
											editor.setTool(entry.id);
											// Leaving the select tool disarms a pending paste so no stray stamp lands.
											if (entry.id !== "select") canvas.armPaste(false);
											refresh();
										}),
									]}
								>
									{entry.label}
								</button>
							))}
						</div>
					</div>
					{editor.tool === "select" ? (
						<div mix={LABEL}>
							Selection
							<div mix={css({ display: "flex", gap: "0.35rem" })}>
								<button
									type="button"
									disabled={editor.selectionRegion === null}
									title="Copy the selected region to the clipboard"
									mix={[
										css({
											...CONTROL_BUTTON,
											opacity: editor.selectionRegion === null ? 0.45 : 1,
											cursor: editor.selectionRegion === null ? "not-allowed" : "pointer",
										}),
										on<HTMLButtonElement, "click">("click", () => copySelection()),
									]}
								>
									Copy
								</button>
								<button
									type="button"
									disabled={editor.selectionRegion === null}
									title="Cut the selected region to the clipboard (clears it on the layer)"
									mix={[
										css({
											...CONTROL_BUTTON,
											opacity: editor.selectionRegion === null ? 0.45 : 1,
											cursor: editor.selectionRegion === null ? "not-allowed" : "pointer",
										}),
										on<HTMLButtonElement, "click">("click", () => cutSelection()),
									]}
								>
									Cut
								</button>
								<button
									type="button"
									disabled={!editor.hasClipboard}
									title="Stamp the clipboard: click the map to place it"
									mix={[
										css({
											...CONTROL_BUTTON,
											borderColor: canvas.pasteArmed ? ACCENT : IDLE_BORDER,
											background: canvas.pasteArmed ? "#1e1b4b" : "#18181b",
											opacity: editor.hasClipboard ? 1 : 0.45,
											cursor: editor.hasClipboard ? "pointer" : "not-allowed",
										}),
										on<HTMLButtonElement, "click">("click", () => armPaste()),
									]}
								>
									{canvas.pasteArmed ? "Click map to paste" : "Paste"}
								</button>
							</div>
						</div>
					) : null}

					{editor.layer === "collision" ? (
						<div mix={LABEL}>
							Collision kind
							<div mix={css({ display: "flex", gap: "0.35rem" })}>
								{COLLISION_KINDS.map((entry) => (
									<button
										key={entry.id}
										type="button"
										mix={[
											css({
												...CONTROL_BUTTON,
												borderColor: editor.collisionKind === entry.id ? ACCENT : IDLE_BORDER,
												// A swatch of the kind's overlay color so the mapping is obvious.
												boxShadow: `inset 0 -3px 0 0 ${entry.color}`,
											}),
											on<HTMLButtonElement, "click">("click", () => {
												editor.setCollisionKind(entry.id);
												refresh();
											}),
										]}
									>
										{entry.label}
									</button>
								))}
							</div>
						</div>
					) : null}

					{/* Layer visibility toggles. */}
					<div mix={LABEL}>
						Show layers
						<div mix={css({ display: "flex", gap: "0.35rem" })}>
							{EDIT_LAYERS.filter((entry) => entry.id !== "collision").map((entry) => {
								let visible = editor.isLayerVisible(entry.id as TileLayerName);
								return (
									<button
										key={entry.id}
										type="button"
										title={`${visible ? "Hide" : "Show"} ${entry.label}`}
										mix={[
											css({
												...CONTROL_BUTTON,
												padding: "0.4rem 0.6rem",
												opacity: visible ? 1 : 0.45,
												borderColor: visible ? ACCENT : IDLE_BORDER,
											}),
											on<HTMLButtonElement, "click">("click", () => {
												editor.toggleLayer(entry.id as TileLayerName);
												refresh();
											}),
										]}
									>
										{visible ? "◉" : "◯"} {entry.label}
									</button>
								);
							})}
						</div>
					</div>

					{/* View toggles: grid + always-on collision overlay. */}
					<div mix={LABEL}>
						View
						<div mix={css({ display: "flex", gap: "0.35rem" })}>
							<button
								type="button"
								mix={[
									css({
										...CONTROL_BUTTON,
										borderColor: editor.showGrid ? ACCENT : IDLE_BORDER,
										opacity: editor.showGrid ? 1 : 0.55,
									}),
									on<HTMLButtonElement, "click">("click", () => {
										editor.toggleGrid();
										refresh();
									}),
								]}
							>
								# Grid
							</button>
							<button
								type="button"
								title="Show the collision overlay on every layer"
								mix={[
									css({
										...CONTROL_BUTTON,
										borderColor: editor.showCollision ? ACCENT : IDLE_BORDER,
										opacity: editor.showCollision ? 1 : 0.55,
									}),
									on<HTMLButtonElement, "click">("click", () => {
										editor.toggleCollision();
										refresh();
									}),
								]}
							>
								⛰ Collision
							</button>
						</div>
					</div>

					{/* Zoom stepper. */}
					<div mix={LABEL}>
						Zoom
						<div mix={css({ display: "flex", gap: "0.35rem", alignItems: "center" })}>
							<button
								type="button"
								title="Zoom out"
								mix={[
									css({
										...CONTROL_BUTTON,
										padding: "0.4rem 0.65rem",
										opacity: editor.zoom <= MIN_ZOOM ? 0.45 : 1,
									}),
									on<HTMLButtonElement, "click">("click", () => {
										editor.stepZoom(-1);
										refresh();
									}),
								]}
							>
								−
							</button>
							<span
								mix={css({
									minWidth: "2.75rem",
									textAlign: "center",
									color: "#e5e7eb",
									fontSize: "0.85rem",
								})}
							>
								{editor.zoom}×
							</span>
							<button
								type="button"
								title="Zoom in"
								mix={[
									css({
										...CONTROL_BUTTON,
										padding: "0.4rem 0.65rem",
										opacity: editor.zoom >= MAX_ZOOM ? 0.45 : 1,
									}),
									on<HTMLButtonElement, "click">("click", () => {
										editor.stepZoom(1);
										refresh();
									}),
								]}
							>
								+
							</button>
						</div>
					</div>
				</div>

				{/* Sidebar + canvas. */}
				<div
					mix={css({ display: "flex", flexWrap: "wrap", gap: "1.5rem", alignItems: "flex-start" })}
				>
					{/* Tileset sidebar. */}
					<aside mix={css({ display: "grid", gap: "0.75rem", width: "18rem" })}>
						<h3 mix={css({ margin: 0, fontSize: "1rem" })}>Tilesets</h3>

						{/* Selected-tile preview so the active brush is always visible. */}
						<SelectedTilePreview
							loaded={loaded[editor.selection.tilesetIndex] ?? null}
							tilesetIndex={editor.selection.tilesetIndex}
							tileIndex={editor.selection.tileIndex}
						/>

						<div mix={css({ display: "grid", gap: "0.5rem" })}>
							<label mix={LABEL}>
								Manifest image
								<select
									value={tilesetImageChoice}
									mix={[
										css(FIELD),
										on<HTMLSelectElement, "change">("change", (event) => {
											tilesetImageChoice = (event.target as HTMLSelectElement).value;
										}),
									]}
								>
									{IMAGE_IDS.length === 0 ? <option value="">(no manifest images)</option> : null}
									{IMAGE_IDS.map((id) => (
										<option key={id} value={id} selected={tilesetImageChoice === id}>
											{id}
										</option>
									))}
								</select>
							</label>
							<label mix={LABEL}>
								…or image URL
								<input
									type="text"
									value={tilesetUrl}
									placeholder="/assets/overworld.png"
									mix={[
										css(FIELD),
										on<HTMLInputElement, "input">("input", (event) => {
											tilesetUrl = (event.target as HTMLInputElement).value;
										}),
									]}
								/>
							</label>
							<label mix={LABEL}>
								Columns
								<input
									type="number"
									min="1"
									value={String(tilesetColumns)}
									mix={[
										css({ ...FIELD, width: "6rem" }),
										on<HTMLInputElement, "change">("change", (event) => {
											tilesetColumns = Number((event.target as HTMLInputElement).value);
										}),
									]}
								/>
							</label>
							<button
								type="button"
								mix={[
									css(CONTROL_BUTTON),
									on<HTMLButtonElement, "click">("click", () => void addTileset()),
								]}
							>
								Load tileset
							</button>
						</div>

						{editor.tilesets.map((tileset, index) => (
							<TilesetPalette
								key={`${tileset.id}-${index}`}
								index={index}
								tileset={tileset}
								loaded={loaded[index] ?? null}
								selectedTileset={editor.selection.tilesetIndex}
								selectedTile={editor.selection.tileIndex}
								onSelect={(tileIndex) => {
									editor.selectTile(index, tileIndex);
									refresh();
								}}
								onRemove={() => removeTileset(index)}
							/>
						))}
					</aside>

					{/* Map canvas. */}
					<div mix={css({ display: "grid", gap: "0.5rem", flex: "1 1 24rem", minWidth: "0" })}>
						<div
							mix={css({
								overflow: "auto",
								maxWidth: "100%",
								maxHeight: "70vh",
								padding: "0.5rem",
								background: "#141417",
								border: "1px solid #27272a",
								borderRadius: "0.5rem",
							})}
						>
							<canvas
								mix={[
									css({
										imageRendering: "pixelated",
										display: "block",
										touchAction: "none",
										cursor: "crosshair",
									}),
									ref<HTMLCanvasElement>((element, signal) => {
										canvas.attach(element);
										signal.addEventListener("abort", () => canvas.detach());
									}),
								]}
							/>
						</div>
						<div
							mix={css({
								display: "flex",
								flexWrap: "wrap",
								gap: "0.75rem",
								alignItems: "center",
								color: "#9ca3af",
								fontSize: "0.8rem",
							})}
						>
							<span
								mix={css({
									fontVariantNumeric: "tabular-nums",
									color: hoverTile ? "#e5e7eb" : "#6b7280",
								})}
							>
								{hoverTile ? `tile (${hoverTile.x}, ${hoverTile.y})` : "tile (–, –)"}
							</span>
							<span mix={css({ color: "#3f3f46" })}>•</span>
							<span>
								{editor.width}×{editor.height} @ {editor.zoom}×
							</span>
							<span mix={css({ color: "#3f3f46" })}>•</span>
							<span>
								{editor.tilesets.length === 0
									? "Load a tileset to start painting."
									: `${editor.tilesets.length} tileset(s), ${editor.events.length} event(s).`}
							</span>
						</div>

						{/* Legend for the event trigger badges + collision colors. */}
						<div
							mix={css({
								display: "flex",
								flexWrap: "wrap",
								gap: "0.75rem",
								alignItems: "center",
								fontSize: "0.72rem",
								color: "#9ca3af",
							})}
						>
							{TRIGGER_LEGEND.map((entry) => {
								let style = eventMarkerStyle({
									id: "",
									x: 0,
									y: 0,
									name: undefined,
									pages: [{ ...defaultPage(), trigger: entry.id }],
								});
								return (
									<span
										key={entry.id}
										mix={css({ display: "flex", gap: "0.3rem", alignItems: "center" })}
									>
										<span
											mix={css({
												display: "inline-flex",
												width: "1rem",
												height: "1rem",
												alignItems: "center",
												justifyContent: "center",
												borderRadius: "0.15rem",
												fontSize: "0.62rem",
												color: "#0b1120",
												background: style.color,
											})}
										>
											{style.glyph}
										</span>
										{entry.label}
									</span>
								);
							})}
							{COLLISION_KINDS.filter((entry) => entry.id !== "walkable").map((entry) => (
								<span
									key={entry.id}
									mix={css({ display: "flex", gap: "0.3rem", alignItems: "center" })}
								>
									<span
										mix={css({
											display: "inline-block",
											width: "1rem",
											height: "1rem",
											borderRadius: "0.15rem",
											background: entry.color,
											border: "1px solid #27272a",
										})}
									/>
									{entry.label}
								</span>
							))}
						</div>
					</div>

					{/* Event editor dialog (modal), opened when an event is placed/clicked. */}
					{selectedEvent ? (
						<EventEditor event={selectedEvent} onCommit={commitEvent} onCancel={cancelEvent} />
					) : null}
				</div>

				<div mix={css({ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" })}>
					<button
						type="button"
						title="Export the active map to src/content/maps and register it"
						mix={[
							css({
								padding: "0.55rem 1rem",
								fontFamily: "inherit",
								color: "#052e16",
								background: "#4ade80",
								border: "none",
								borderRadius: "0.375rem",
								cursor: "pointer",
							}),
							on<HTMLButtonElement, "click">("click", () => void exportMap()),
						]}
					>
						Export map
					</button>
					<button
						type="button"
						title="Export every map in the project and register each in the manifest"
						mix={[
							css({
								...CONTROL_BUTTON,
								padding: "0.55rem 1rem",
								borderColor: "#4ade80",
								color: "#4ade80",
							}),
							on<HTMLButtonElement, "click">("click", () => void exportAll()),
						]}
					>
						Export all ({project.size})
					</button>
				</div>

				{status ? (
					<p
						mix={css({
							margin: 0,
							fontSize: "0.85rem",
							color: statusIsError ? "#f87171" : "#4ade80",
						})}
					>
						{status}
					</p>
				) : null}
			</section>
		);
	};
}

/** Finds an event on the editor by id, or `null`. */
function findEvent(editor: MapEditor, id: string): MapEvent | null {
	return editor.events.find((event) => event.id === id) ?? null;
}

/** Props for the map-tree panel (the project's list of maps + create controls). */
interface MapTreePanelProps {
	/** The project's map ids, in tree order. */
	ids: string[];
	/** The id of the active map (highlighted in the list). */
	activeId: string;
	/** The id typed into the new-map field. */
	newMapId: string;
	/** The width (in tiles) a new map is created at. */
	newMapWidth: number;
	/** The height (in tiles) a new map is created at. */
	newMapHeight: number;
	/** Called as the new-map id field changes. */
	onNewMapIdInput: (value: string) => void;
	/** Called as the new-map width field changes. */
	onNewMapWidthInput: (value: number) => void;
	/** Called as the new-map height field changes. */
	onNewMapHeightInput: (value: number) => void;
	/** Called to create the new map from the current field values. */
	onAdd: () => void;
	/** Called with a map id to make it the active map. */
	onSelect: (id: string) => void;
	/** Called with the old and new id to rename a map. */
	onRename: (oldId: string, newId: string) => void;
	/** Called with a map id to delete it. */
	onDelete: (id: string) => void;
}

/**
 * The map tree: the project's ordered list of maps (the active one highlighted) with
 * a create row (id + width×height + New map) above it. Clicking a map selects it;
 * each row has Rename (prompts for a new id) and Delete (disabled when only one map
 * remains so a project always keeps at least one). All lifecycle changes are handled
 * by the parent through the callbacks; this component only renders and dispatches.
 *
 * @param handle Component handle exposing the tree props.
 * @returns The render function for the map-tree panel.
 */
function MapTreePanel(handle: Handle<MapTreePanelProps>) {
	return () => {
		let props = handle.props;
		let onlyOne = props.ids.length <= 1;
		return (
			<div
				mix={css({
					display: "grid",
					gap: "0.6rem",
					width: "100%",
					padding: "0.75rem 1rem",
					background: "#141417",
					border: "1px solid #27272a",
					borderRadius: "0.5rem",
				})}
			>
				<div mix={css({ display: "flex", justifyContent: "space-between", alignItems: "center" })}>
					<h3 mix={css({ margin: 0, fontSize: "1rem" })}>Maps</h3>
					<span mix={css({ fontSize: "0.72rem", color: "#9ca3af" })}>
						{props.ids.length} map{props.ids.length === 1 ? "" : "s"}
					</span>
				</div>

				{/* New-map row. */}
				<div
					mix={css({ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "flex-end" })}
				>
					<label mix={LABEL}>
						New map id
						<input
							type="text"
							value={props.newMapId}
							placeholder="route-2"
							mix={[
								css({ ...FIELD, width: "10rem" }),
								on<HTMLInputElement, "input">("input", (event) => {
									props.onNewMapIdInput((event.target as HTMLInputElement).value);
								}),
							]}
						/>
					</label>
					<label mix={LABEL}>
						Width
						<input
							type="number"
							min="1"
							value={String(props.newMapWidth)}
							mix={[
								css({ ...FIELD, width: "5rem" }),
								on<HTMLInputElement, "change">("change", (event) => {
									props.onNewMapWidthInput(Number((event.target as HTMLInputElement).value));
								}),
							]}
						/>
					</label>
					<label mix={LABEL}>
						Height
						<input
							type="number"
							min="1"
							value={String(props.newMapHeight)}
							mix={[
								css({ ...FIELD, width: "5rem" }),
								on<HTMLInputElement, "change">("change", (event) => {
									props.onNewMapHeightInput(Number((event.target as HTMLInputElement).value));
								}),
							]}
						/>
					</label>
					<button
						type="button"
						mix={[
							css(CONTROL_BUTTON),
							on<HTMLButtonElement, "click">("click", () => props.onAdd()),
						]}
					>
						New map
					</button>
				</div>

				{/* The map list. */}
				<ul
					mix={css({
						listStyle: "none",
						margin: 0,
						padding: 0,
						display: "grid",
						gap: "0.25rem",
						maxHeight: "16rem",
						overflowY: "auto",
					})}
				>
					{props.ids.map((id) => {
						let isActive = id === props.activeId;
						return (
							<li
								key={id}
								mix={css({
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									gap: "0.5rem",
									padding: "0.35rem 0.5rem",
									borderRadius: "0.375rem",
									background: isActive ? "#1e1b4b" : "#18181b",
									border: `1px solid ${isActive ? ACCENT : IDLE_BORDER}`,
								})}
							>
								<button
									type="button"
									title={`Edit map "${id}"`}
									mix={[
										css({
											flex: "1 1 auto",
											textAlign: "left",
											padding: 0,
											fontFamily: "inherit",
											fontSize: "0.85rem",
											color: isActive ? "#c7d2fe" : "#e5e7eb",
											background: "transparent",
											border: "none",
											cursor: "pointer",
										}),
										on<HTMLButtonElement, "click">("click", () => props.onSelect(id)),
									]}
								>
									{isActive ? "▸ " : ""}
									{id}
								</button>
								<button
									type="button"
									title="Rename this map"
									mix={[
										css({ ...CONTROL_BUTTON, padding: "0.15rem 0.4rem", fontSize: "0.72rem" }),
										on<HTMLButtonElement, "click">("click", () => {
											let next = window.prompt(`Rename map "${id}" to:`, id);
											if (next !== null && next.trim() !== id) props.onRename(id, next);
										}),
									]}
								>
									Rename
								</button>
								<button
									type="button"
									disabled={onlyOne}
									title={onlyOne ? "A project must keep at least one map" : "Delete this map"}
									mix={[
										css({
											...CONTROL_BUTTON,
											padding: "0.15rem 0.4rem",
											fontSize: "0.72rem",
											opacity: onlyOne ? 0.45 : 1,
											cursor: onlyOne ? "not-allowed" : "pointer",
										}),
										on<HTMLButtonElement, "click">("click", () => {
											if (onlyOne) return;
											props.onDelete(id);
										}),
									]}
								>
									Delete
								</button>
							</li>
						);
					})}
				</ul>
			</div>
		);
	};
}

/** Props for one tileset's clickable tile-grid palette. */
interface TilesetPaletteProps {
	/** This tileset's index in the editor's `tilesets`. */
	index: number;
	/** The tileset declaration (columns, tile size). */
	tileset: Tileset;
	/** The loaded image, or null while it is still loading / failed. */
	loaded: LoadedTileset | null;
	/** The currently selected tileset index (to highlight this palette). */
	selectedTileset: number;
	/** The currently selected tile index within the selected tileset. */
	selectedTile: number;
	/** Called with a tile index when a tile is clicked. */
	onSelect: (tileIndex: number) => void;
	/** Called when this tileset's remove button is clicked. */
	onRemove: () => void;
}

/**
 * One tileset rendered as a grid of clickable tiles. The selected tile is
 * highlighted; clicking a tile selects it (carrying this tileset's index). A
 * canvas per tile blits the tile's source rect from the loaded image.
 *
 * @param handle Component handle used to schedule re-renders (unused; props drive it).
 * @returns The render function for one tileset palette.
 */
function TilesetPalette(handle: Handle<TilesetPaletteProps>) {
	return () => {
		let props = handle.props;
		let loaded = props.loaded;
		let tileCount = loaded ? countTiles(loaded) : props.tileset.columns * 4;
		let columns = props.tileset.columns;
		let isActive = props.selectedTileset === props.index;
		let dimensions = loaded ? `${loaded.element.width}×${loaded.element.height}px` : "loading";
		return (
			<div
				mix={css({
					display: "grid",
					gap: "0.4rem",
					padding: "0.5rem",
					background: isActive ? "#141417" : "transparent",
					border: `1px solid ${isActive ? ACCENT : IDLE_BORDER}`,
					borderRadius: "0.375rem",
				})}
			>
				<div
					mix={css({
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						gap: "0.5rem",
					})}
				>
					<span mix={css({ display: "grid", gap: "0.1rem" })}>
						<span mix={css({ fontSize: "0.8rem", color: "#e5e7eb" })}>
							#{props.index} {props.tileset.id}
						</span>
						<span mix={css({ fontSize: "0.68rem", color: "#9ca3af" })}>
							{dimensions} · {columns} cols · {tileCount} tiles
						</span>
					</span>
					<button
						type="button"
						mix={[
							css({ ...CONTROL_BUTTON, padding: "0.15rem 0.4rem", fontSize: "0.75rem" }),
							on<HTMLButtonElement, "click">("click", () => props.onRemove()),
						]}
					>
						Remove
					</button>
				</div>
				{loaded === null ? (
					<span mix={css({ fontSize: "0.75rem", color: "#9ca3af" })}>Image not loaded.</span>
				) : (
					<div
						mix={css({
							display: "grid",
							gridTemplateColumns: `repeat(${columns}, 1fr)`,
							gap: "1px",
							background: "#27272a",
							padding: "1px",
							borderRadius: "0.25rem",
						})}
					>
						{Array.from({ length: tileCount }, (_, tileIndex) => {
							let isSelected = isActive && props.selectedTile === tileIndex;
							return (
								<canvas
									key={tileIndex}
									title={`Tile ${tileIndex}`}
									mix={[
										css({
											width: "100%",
											aspectRatio: "1 / 1",
											imageRendering: "pixelated",
											borderRadius: "0.1rem",
											outline: isSelected ? `2px solid ${ACCENT}` : "1px solid #18181b",
											outlineOffset: isSelected ? "1px" : "0",
											boxShadow: isSelected ? "0 0 0 1px #c7d2fe" : "none",
											cursor: "pointer",
											transition: "outline-color 80ms ease",
										}),
										css({ "&:hover": { outline: "2px solid #a5b4fc" } } as Styles),
										ref<HTMLCanvasElement>((element) => {
											drawTilePreview(element, loaded, tileIndex);
										}),
										on<HTMLCanvasElement, "click">("click", () => props.onSelect(tileIndex)),
									]}
								/>
							);
						})}
					</div>
				)}
			</div>
		);
	};
}

/** Props for the always-visible selected-tile preview. */
interface SelectedTilePreviewProps {
	/** The loaded tileset the selected tile is from, or null. */
	loaded: LoadedTileset | null;
	/** The selected tileset index (for the caption). */
	tilesetIndex: number;
	/** The selected tile index within that tileset. */
	tileIndex: number;
}

/**
 * A large preview of the currently selected tile (the active paint brush), shown at
 * the top of the sidebar so the author always sees what will be painted. Renders a
 * dashed "no tile" placeholder before a tileset is loaded.
 *
 * @param handle Component handle exposing the preview props.
 * @returns The render function for the selected-tile preview.
 */
function SelectedTilePreview(handle: Handle<SelectedTilePreviewProps>) {
	return () => {
		let { loaded, tilesetIndex, tileIndex } = handle.props;
		return (
			<div
				mix={css({
					display: "flex",
					gap: "0.6rem",
					alignItems: "center",
					padding: "0.5rem",
					background: "#141417",
					border: "1px solid #27272a",
					borderRadius: "0.375rem",
				})}
			>
				{loaded === null ? (
					<div
						mix={css({
							width: "48px",
							height: "48px",
							borderRadius: "0.25rem",
							border: "2px dashed #3f3f46",
						})}
					/>
				) : (
					<canvas
						mix={[
							css({
								width: "48px",
								height: "48px",
								imageRendering: "pixelated",
								borderRadius: "0.25rem",
								outline: `2px solid ${ACCENT}`,
							}),
							ref<HTMLCanvasElement>((element) => drawTilePreview(element, loaded, tileIndex)),
						]}
					/>
				)}
				<div mix={css({ display: "grid", gap: "0.15rem" })}>
					<span mix={css({ fontSize: "0.8rem", color: "#e5e7eb" })}>Selected tile</span>
					<span mix={css({ fontSize: "0.72rem", color: "#9ca3af" })}>
						{loaded === null ? "no tileset loaded" : `set #${tilesetIndex} · tile ${tileIndex}`}
					</span>
				</div>
			</div>
		);
	};
}

/** Counts how many whole tiles a loaded tileset image holds. */
function countTiles(loaded: LoadedTileset): number {
	let columns = loaded.columns;
	let rows = Math.max(1, Math.floor(loaded.element.height / loaded.tileHeight));
	return columns * rows;
}

/** Blits one tile's source rect into a small preview canvas. */
function drawTilePreview(
	canvas: HTMLCanvasElement,
	loaded: LoadedTileset,
	tileIndex: number,
): void {
	let size = 24;
	canvas.width = size;
	canvas.height = size;
	let context = canvas.getContext("2d");
	if (context === null) return;
	context.imageSmoothingEnabled = false;
	let source = tileSourceRect(
		{
			id: "",
			image: loaded.image,
			columns: loaded.columns,
			tileWidth: loaded.tileWidth,
			tileHeight: loaded.tileHeight,
		},
		tileIndex,
	);
	context.drawImage(loaded.element, source.x, source.y, source.w, source.h, 0, 0, size, size);
}
