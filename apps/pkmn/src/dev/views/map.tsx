/**
 * Map + Events tool view — an RPG-Maker-XP-style tile-map editor built on the
 * canonical tool-view pattern. The component constructs a {@link MapEditor} once
 * in setup and drives every control through it; there are no framework hooks, so
 * local UI state lives in setup-scope variables and the view re-renders through
 * `handle.update()` when a control changes it. A {@link MapCanvas} DOM helper (the
 * imperative shell around the pure editor) blits the map to a canvas and turns
 * pointer input into paint/erase/fill/event gestures.
 *
 * The surface has four regions: new-map controls (id, width×height in tiles, tile
 * size), a tileset sidebar (load one or more tileset images from the manifest
 * `images`/`atlases` or a URL, each sliced into a clickable tile grid — the
 * selected tile carries its tileset index), a layer/tool bar (ground/decor/
 * overhead/collision plus paint/erase/fill/event, and the collision kind when
 * editing collision), and the map canvas itself. In event mode a click places or
 * selects an event; a side panel edits its {@link MapEvent} fields per the schema —
 * kind, facing, sprite (atlas region / raw image / none), movement (none/random/
 * route), interaction mode, a small script builder (message / start-trainer-battle
 * / set-flag / warp), and the trainer party or wild species+level the kind needs.
 * Export POSTs the serialized {@link MapData} to the map export action.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css, on, ref } from "remix/ui";

import manifest from "~/content/manifest.json";
import { SPECIES } from "~/content/species";
import {
	EMPTY_CELL,
	type MapEvent,
	type ScriptCommand,
	type Tileset,
	unpackTileRef,
} from "~/presentation/render/map-schema";
import { Collision, tileSourceRect } from "~/presentation/render/tilemap";

import {
	type CollisionKind,
	COLLISION_VALUES,
	type EditLayer,
	MapEditor,
	MAX_ZOOM,
	MIN_ZOOM,
	type MapTool,
	TILE_LAYERS,
	type TileLayerName,
} from "../editors/map-editor";
import {
	canvasSize,
	eventMarkerStyle,
	screenToTile,
	tileScreenRect,
	tileScreenSize,
} from "../map-render";

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

/** Sentinel `<option>` value meaning "no sprite" in the event sprite picker. */
const NO_SPRITE = "";

/** Sorted list of manifest image ids the tileset/sprite pickers offer. */
const IMAGE_IDS = Object.keys(
	(manifest as { images?: Record<string, string> }).images ?? {},
).sort();

/** Sorted list of manifest atlas ids the event sprite picker offers. */
const ATLAS_IDS = Object.keys(
	(manifest as { atlases?: Record<string, unknown> }).atlases ?? {},
).sort();

/** Sorted list of real species ids the trainer/wild pickers offer. */
const SPECIES_IDS = Object.keys(SPECIES).sort();

/** The indigo accent the editor uses to mark the active control/selection. */
const ACCENT = "#6366f1";

/** The idle border color shared by the small control buttons. */
const IDLE_BORDER = "#3f3f46";

/** The cardinal directions offered by facing / route pickers. */
const DIRECTIONS = ["up", "down", "left", "right"] as const;

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
	{ id: "event", label: "Event" },
];

/** The collision kinds, in bar order, with their labels and overlay colors. */
const COLLISION_KINDS: Array<{ id: CollisionKind; label: string; color: string }> = [
	{ id: "walkable", label: "Walkable", color: "rgba(74, 222, 128, 0.35)" },
	{ id: "solid", label: "Solid", color: "rgba(248, 113, 113, 0.45)" },
	{ id: "water", label: "Water", color: "rgba(96, 165, 250, 0.45)" },
	{ id: "ledge", label: "Ledge", color: "rgba(250, 204, 21, 0.45)" },
];

/** The script commands the small script builder can append, with labels. */
const SCRIPT_COMMANDS: Array<{ id: ScriptCommand["do"]; label: string }> = [
	{ id: "message", label: "Message" },
	{ id: "start-trainer-battle", label: "Start trainer battle" },
	{ id: "set-flag", label: "Set flag" },
	{ id: "warp", label: "Warp" },
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

/** Ledger of the marker glyphs → color for a small on-canvas event legend. */
const EVENT_GLYPHS: Record<MapEvent["kind"], string> = { npc: "N", wild: "W", trigger: "T" };

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

	/** The tile currently under the pointer, or `null` when the pointer is off-canvas. */
	#hover: { x: number; y: number } | null = null;

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
	 */
	constructor(
		private readonly editor: MapEditor,
		private tilesets: Array<LoadedTileset | null>,
		private readonly onChange: () => void,
		private readonly onPickEvent: (id: string | null) => void,
		private readonly onHover: (tile: { x: number; y: number } | null) => void,
	) {}

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
	 * Blits an event's chosen sprite into its tile rect, scaled to fill. Supports a
	 * raw image sub-rect (image id + x/y/w/h) from a loaded tileset image and, when
	 * the atlas image happens to be loaded as a tileset, an atlas region drawn from
	 * that image is out of scope (atlases aren't loaded here) so those fall back to
	 * the badge placeholder. Returns whether a sprite was drawn.
	 */
	#drawEventSprite(
		context: CanvasRenderingContext2D,
		event: MapEvent,
		rect: { x: number; y: number; w: number; h: number },
	): boolean {
		let sprite = event.sprite;
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
				let placed = this.editor.addEvent(tile.x, tile.y, "trigger");
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

	/** Begins a gesture; paint/erase drag, fill/event are one-shot. */
	#handlePointerDown(event: PointerEvent): void {
		let tile = this.#tileAt(event);
		if (tile === null) return;
		let dragTool = this.editor.tool === "paint" || this.editor.tool === "erase";
		if (dragTool) {
			this.#painting = true;
			this.#canvas?.setPointerCapture(event.pointerId);
		}
		this.#applyAt(tile);
	}

	/** Tracks the hovered tile and continues a paint/erase drag while held. */
	#handlePointerMove(event: PointerEvent): void {
		let tile = this.#tileAt(event);
		this.#updateHover(tile);
		if (this.#painting && tile !== null) this.#applyAt(tile);
	}

	/** Ends a drag. */
	#stopPainting(): void {
		this.#painting = false;
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
	let editor = new MapEditor();

	// View-owned loaded tileset images, indexed to match the editor's tilesets.
	let loaded: Array<LoadedTileset | null> = [];

	// Local UI state, mirrored back into the view on `handle.update()`.
	let mapId = "";
	let bgm = "";
	let newWidth = editor.width;
	let newHeight = editor.height;
	let tileSize = editor.tileWidth;
	let selectedEventId: string | null = null;

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
	);

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

	/** Recreates the map at the new-map control sizes, dropping content. */
	function createMap() {
		editor.setId(mapId).createMap(newWidth, newHeight, tileSize, tileSize);
		selectedEventId = null;
		report(`New ${editor.width}×${editor.height} map.`, false);
		refresh();
	}

	/** Resizes the current map, preserving content. */
	function resizeMap() {
		editor.resize(newWidth, newHeight);
		selectedEventId = null;
		report(`Resized to ${editor.width}×${editor.height}.`, false);
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

	/** Patches the selected event and re-renders. */
	function configureSelected(patch: Partial<MapEvent>) {
		if (selectedEventId === null) return;
		editor.configureEvent(selectedEventId, patch);
		refresh();
	}

	/** Removes the selected event. */
	function removeSelected() {
		if (selectedEventId === null) return;
		editor.removeEvent(selectedEventId);
		selectedEventId = null;
		refresh();
	}

	/** Serializes the current map and POSTs it to the export action. */
	async function exportMap() {
		let map = editor.toMapData();
		if (map.id.length === 0) {
			report("Enter a map id before exporting.", true);
			return;
		}
		report("Exporting…", false);
		try {
			let response = await fetch("/dev/export/map", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(map),
			});
			let data = (await response.json()) as { path?: string; url?: string; error?: string };
			if (response.ok) report(`Wrote ${data.path} and registered "${map.id}" → ${data.url}`, false);
			else report(`Export failed: ${data.error ?? response.statusText}`, true);
		} catch (error) {
			report(`Export failed: ${error instanceof Error ? error.message : String(error)}`, true);
		}
	}

	return () => {
		let selectedEvent = selectedEventId ? findEvent(editor, selectedEventId) : null;
		return (
			<section mix={css({ display: "grid", gap: "1rem", justifyItems: "start" })}>
				<header mix={css({ display: "grid", gap: "0.25rem" })}>
					<h2 mix={css({ margin: 0, fontSize: "1.25rem" })}>Map + Events</h2>
					<p mix={css({ margin: 0, color: "#9ca3af", fontSize: "0.85rem" })}>
						Compose a tile map across the ground / decor / overhead layers, paint collision, place
						events, then export it to <code>src/content/maps</code> and register it in the manifest.
					</p>
				</header>

				{/* New-map controls. */}
				<div
					mix={css({ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" })}
				>
					<label mix={LABEL}>
						Map id
						<input
							type="text"
							value={mapId}
							placeholder="route-2"
							mix={[
								css({ ...FIELD, width: "10rem" }),
								on<HTMLInputElement, "input">("input", (event) => {
									mapId = (event.target as HTMLInputElement).value;
									editor.setId(mapId);
								}),
							]}
						/>
					</label>
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
					<label mix={LABEL}>
						Tile size (px)
						<input
							type="number"
							min="1"
							value={String(tileSize)}
							mix={[
								css({ ...FIELD, width: "6rem" }),
								on<HTMLInputElement, "change">("change", (event) => {
									tileSize = Number((event.target as HTMLInputElement).value);
								}),
							]}
						/>
					</label>
					<button
						type="button"
						mix={[css(CONTROL_BUTTON), on<HTMLButtonElement, "click">("click", () => createMap())]}
					>
						New map
					</button>
					<button
						type="button"
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
											refresh();
										}),
									]}
								>
									{entry.label}
								</button>
							))}
						</div>
					</div>
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

						{/* Legend for the event badges + collision colors. */}
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
							{(["npc", "wild", "trigger"] as const).map((kind) => (
								<span
									key={kind}
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
											background: eventMarkerStyle({
												kind,
												sprite: null,
											} as MapEvent).color,
										})}
									>
										{EVENT_GLYPHS[kind]}
									</span>
									{kind}
								</span>
							))}
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

					{/* Event panel. */}
					{selectedEvent ? (
						<EventPanel
							event={selectedEvent}
							onConfigure={configureSelected}
							onRemove={removeSelected}
							onClose={() => {
								selectedEventId = null;
								void handle.update();
							}}
						/>
					) : null}
				</div>

				<button
					type="button"
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

/** Props for the per-event configuration side panel. */
interface EventPanelProps {
	/** The event being edited (a snapshot; edits flow through `onConfigure`). */
	event: MapEvent;
	/** Applies a field-level patch to the event. */
	onConfigure: (patch: Partial<MapEvent>) => void;
	/** Removes the event. */
	onRemove: () => void;
	/** Closes the panel without removing the event. */
	onClose: () => void;
}

/**
 * The event configuration side panel. Edits the selected {@link MapEvent}'s fields
 * per the schema: id, kind, facing, sprite (atlas region / raw image / none),
 * movement (none / random / route), interaction mode, a small script builder, and
 * the trainer party or wild species+level the kind needs.
 *
 * @param handle Component handle exposing the event props.
 * @returns The render function for the event panel.
 */
function EventPanel(handle: Handle<EventPanelProps>) {
	return () => {
		let { event, onConfigure, onRemove, onClose } = handle.props;
		return (
			<aside
				mix={css({
					display: "grid",
					gap: "0.6rem",
					width: "20rem",
					padding: "0.85rem 1rem 1rem",
					border: "1px solid #3f3f46",
					borderRadius: "0.5rem",
				})}
			>
				<div mix={css({ display: "flex", justifyContent: "space-between", alignItems: "center" })}>
					<h3 mix={css({ margin: 0, fontSize: "1rem" })}>
						Event @ {event.x},{event.y}
					</h3>
					<button
						type="button"
						mix={[
							css({ ...CONTROL_BUTTON, padding: "0.15rem 0.4rem", fontSize: "0.75rem" }),
							on<HTMLButtonElement, "click">("click", () => onClose()),
						]}
					>
						Close
					</button>
				</div>

				<label mix={LABEL}>
					Id
					<input
						type="text"
						value={event.id}
						mix={[
							css(FIELD),
							on<HTMLInputElement, "change">("change", (e) => {
								onConfigure({ id: (e.target as HTMLInputElement).value });
							}),
						]}
					/>
				</label>

				<label mix={LABEL}>
					Kind
					<select
						value={event.kind}
						mix={[
							css(FIELD),
							on<HTMLSelectElement, "change">("change", (e) => {
								onConfigure({ kind: (e.target as HTMLSelectElement).value as MapEvent["kind"] });
							}),
						]}
					>
						<option value="npc" selected={event.kind === "npc"}>
							NPC
						</option>
						<option value="wild" selected={event.kind === "wild"}>
							Wild
						</option>
						<option value="trigger" selected={event.kind === "trigger"}>
							Trigger
						</option>
					</select>
				</label>

				<label mix={LABEL}>
					Facing
					<select
						value={event.facing}
						mix={[
							css(FIELD),
							on<HTMLSelectElement, "change">("change", (e) => {
								onConfigure({
									facing: (e.target as HTMLSelectElement).value as MapEvent["facing"],
								});
							}),
						]}
					>
						{DIRECTIONS.map((direction) => (
							<option key={direction} value={direction} selected={event.facing === direction}>
								{direction}
							</option>
						))}
					</select>
				</label>

				<label mix={LABEL}>
					Interaction mode
					<select
						value={event.interactionMode}
						mix={[
							css(FIELD),
							on<HTMLSelectElement, "change">("change", (e) => {
								onConfigure({
									interactionMode: (e.target as HTMLSelectElement)
										.value as MapEvent["interactionMode"],
								});
							}),
						]}
					>
						<option value="action" selected={event.interactionMode === "action"}>
							Action (A press)
						</option>
						<option value="touch" selected={event.interactionMode === "touch"}>
							Touch (step on)
						</option>
						<option value="autorun" selected={event.interactionMode === "autorun"}>
							Autorun
						</option>
					</select>
				</label>

				<label mix={LABEL}>
					Movement
					{(() => {
						let movementMode = typeof event.movement === "object" ? "route" : event.movement;
						return (
							<select
								value={movementMode}
								mix={[
									css(FIELD),
									on<HTMLSelectElement, "change">("change", (e) => {
										let value = (e.target as HTMLSelectElement).value;
										if (value === "route") onConfigure({ movement: { type: "route", steps: [] } });
										else onConfigure({ movement: value as "none" | "random" });
									}),
								]}
							>
								<option value="none" selected={movementMode === "none"}>
									None
								</option>
								<option value="random" selected={movementMode === "random"}>
									Random
								</option>
								<option value="route" selected={movementMode === "route"}>
									Route
								</option>
							</select>
						);
					})()}
				</label>

				{typeof event.movement === "object" ? (
					<RouteEditor
						steps={event.movement.steps}
						onChange={(steps) => onConfigure({ movement: { type: "route", steps } })}
					/>
				) : null}

				<SpritePicker sprite={event.sprite} onChange={(sprite) => onConfigure({ sprite })} />

				<ScriptBuilder
					script={event.interaction.script}
					onChange={(script) => onConfigure({ interaction: { ...event.interaction, script } })}
				/>

				{event.kind === "wild" ? (
					<WildEditor
						wild={event.interaction.wild ?? null}
						onChange={(wild) => onConfigure({ interaction: { ...event.interaction, wild } })}
					/>
				) : null}

				{event.kind === "npc" ? (
					<TrainerEditor
						trainer={event.interaction.trainer ?? null}
						onChange={(trainer) => onConfigure({ interaction: { ...event.interaction, trainer } })}
					/>
				) : null}

				<label
					mix={css({
						display: "flex",
						gap: "0.4rem",
						alignItems: "center",
						fontSize: "0.8rem",
						color: "#9ca3af",
					})}
				>
					<input
						type="checkbox"
						checked={event.once}
						mix={on<HTMLInputElement, "change">("change", (e) => {
							onConfigure({ once: (e.target as HTMLInputElement).checked });
						})}
					/>
					Fires at most once
				</label>

				<label mix={LABEL}>
					Story flag (optional)
					<input
						type="text"
						value={event.flag ?? ""}
						placeholder="caught-legendary"
						mix={[
							css(FIELD),
							on<HTMLInputElement, "change">("change", (e) => {
								let value = (e.target as HTMLInputElement).value.trim();
								onConfigure({ flag: value.length > 0 ? value : undefined });
							}),
						]}
					/>
				</label>

				<button
					type="button"
					mix={[
						css({
							justifySelf: "start",
							padding: "0.4rem 0.75rem",
							fontFamily: "inherit",
							color: "#450a0a",
							background: "#f87171",
							border: "none",
							borderRadius: "0.375rem",
							cursor: "pointer",
						}),
						on<HTMLButtonElement, "click">("click", () => onRemove()),
					]}
				>
					Delete event
				</button>
			</aside>
		);
	};
}

/** Props for the movement-route step editor. */
interface RouteEditorProps {
	/** The current ordered route steps. */
	steps: MapEvent["facing"][];
	/** Called with the updated step list. */
	onChange: (steps: MapEvent["facing"][]) => void;
}

/**
 * Editor for a movement route's ordered steps: shows the current directions and
 * lets the author append or clear steps.
 *
 * @param handle Component handle exposing the route props.
 * @returns The render function for the route editor.
 */
function RouteEditor(handle: Handle<RouteEditorProps>) {
	return () => {
		let { steps, onChange } = handle.props;
		return (
			<div mix={LABEL}>
				Route steps: {steps.length > 0 ? steps.join(" → ") : "(none)"}
				<div mix={css({ display: "flex", flexWrap: "wrap", gap: "0.3rem" })}>
					{DIRECTIONS.map((direction) => (
						<button
							key={direction}
							type="button"
							mix={[
								css({ ...CONTROL_BUTTON, padding: "0.2rem 0.5rem", fontSize: "0.75rem" }),
								on<HTMLButtonElement, "click">("click", () => onChange([...steps, direction])),
							]}
						>
							+{direction}
						</button>
					))}
					<button
						type="button"
						mix={[
							css({ ...CONTROL_BUTTON, padding: "0.2rem 0.5rem", fontSize: "0.75rem" }),
							on<HTMLButtonElement, "click">("click", () => onChange([])),
						]}
					>
						Clear
					</button>
				</div>
			</div>
		);
	};
}

/** Props for the event sprite picker. */
interface SpritePickerProps {
	/** The current sprite (atlas region, raw image, or null). */
	sprite: MapEvent["sprite"];
	/** Called with the updated sprite. */
	onChange: (sprite: MapEvent["sprite"]) => void;
}

/**
 * Picks an event's sprite: none, an atlas region (atlas id + region name), or a
 * raw image sub-rect (image id + x/y/w/h). Matches the schema's `SpriteRef` union.
 *
 * @param handle Component handle exposing the sprite props.
 * @returns The render function for the sprite picker.
 */
function SpritePicker(handle: Handle<SpritePickerProps>) {
	return () => {
		let { sprite, onChange } = handle.props;
		let mode = sprite === null ? "none" : "atlas" in sprite ? "atlas" : "image";
		return (
			<div mix={css({ display: "grid", gap: "0.4rem" })}>
				<label mix={LABEL}>
					Sprite
					<select
						value={mode}
						mix={[
							css(FIELD),
							on<HTMLSelectElement, "change">("change", (e) => {
								let next = (e.target as HTMLSelectElement).value;
								if (next === "none") onChange(null);
								else if (next === "atlas") onChange({ atlas: ATLAS_IDS[0] ?? "", region: "" });
								else onChange({ image: IMAGE_IDS[0] ?? "", x: 0, y: 0, w: 16, h: 16 });
							}),
						]}
					>
						<option value={NO_SPRITE} selected={mode === "none"}>
							None
						</option>
						<option value="atlas" selected={mode === "atlas"}>
							Atlas region
						</option>
						<option value="image" selected={mode === "image"}>
							Raw image rect
						</option>
					</select>
				</label>

				{sprite !== null && "atlas" in sprite ? (
					<div mix={css({ display: "flex", gap: "0.4rem" })}>
						<input
							type="text"
							value={sprite.atlas}
							placeholder="atlas"
							mix={[
								css({ ...FIELD, width: "50%" }),
								on<HTMLInputElement, "change">("change", (e) => {
									onChange({ atlas: (e.target as HTMLInputElement).value, region: sprite.region });
								}),
							]}
						/>
						<input
							type="text"
							value={sprite.region}
							placeholder="hero.down"
							mix={[
								css({ ...FIELD, width: "50%" }),
								on<HTMLInputElement, "change">("change", (e) => {
									onChange({ atlas: sprite.atlas, region: (e.target as HTMLInputElement).value });
								}),
							]}
						/>
					</div>
				) : null}

				{sprite !== null && "image" in sprite ? (
					<div mix={css({ display: "flex", flexWrap: "wrap", gap: "0.4rem" })}>
						<input
							type="text"
							value={sprite.image}
							placeholder="image id"
							mix={[
								css({ ...FIELD, width: "100%" }),
								on<HTMLInputElement, "change">("change", (e) => {
									onChange({ ...sprite, image: (e.target as HTMLInputElement).value });
								}),
							]}
						/>
						{(["x", "y", "w", "h"] as const).map((field) => (
							<input
								key={field}
								type="number"
								min={field === "w" || field === "h" ? "1" : "0"}
								value={String(sprite[field])}
								title={field}
								mix={[
									css({ ...FIELD, width: "3.5rem" }),
									on<HTMLInputElement, "change">("change", (e) => {
										onChange({ ...sprite, [field]: Number((e.target as HTMLInputElement).value) });
									}),
								]}
							/>
						))}
					</div>
				) : null}
			</div>
		);
	};
}

/** Props for the interaction script builder. */
interface ScriptBuilderProps {
	/** The current ordered script commands. */
	script: ScriptCommand[];
	/** Called with the updated command list. */
	onChange: (script: ScriptCommand[]) => void;
}

/**
 * A small declarative script builder for an event interaction. Supports appending
 * and removing the four commonly authored commands — message, start-trainer-battle,
 * set-flag, and warp — and editing each command's fields inline. Advanced commands
 * (give-item, heal-party, face-player, move) are part of the schema but not exposed
 * here; they can be added later without changing the format.
 *
 * @param handle Component handle exposing the script props.
 * @returns The render function for the script builder.
 */
function ScriptBuilder(handle: Handle<ScriptBuilderProps>) {
	return () => {
		let { script, onChange } = handle.props;

		/** Appends a fresh command of the chosen kind with sensible blank fields. */
		function append(kind: ScriptCommand["do"]) {
			let command: ScriptCommand =
				kind === "message"
					? { do: "message", text: "" }
					: kind === "start-trainer-battle"
						? { do: "start-trainer-battle", trainerId: "" }
						: kind === "set-flag"
							? { do: "set-flag", flag: "" }
							: { do: "warp", toMap: "", toX: 0, toY: 0 };
			onChange([...script, command]);
		}

		/** Replaces the command at `index` with an updated copy. */
		function update(index: number, next: ScriptCommand) {
			onChange(script.map((command, i) => (i === index ? next : command)));
		}

		return (
			<div mix={css({ display: "grid", gap: "0.4rem" })}>
				<span mix={css({ fontSize: "0.8rem", color: "#9ca3af" })}>Interaction script</span>
				{script.map((command, index) => (
					<div
						key={index}
						mix={css({
							display: "grid",
							gap: "0.3rem",
							padding: "0.4rem",
							border: "1px solid #27272a",
							borderRadius: "0.3rem",
						})}
					>
						<div
							mix={css({ display: "flex", justifyContent: "space-between", alignItems: "center" })}
						>
							<span mix={css({ fontSize: "0.75rem", color: "#e5e7eb" })}>{command.do}</span>
							<button
								type="button"
								mix={[
									css({ ...CONTROL_BUTTON, padding: "0.1rem 0.35rem", fontSize: "0.7rem" }),
									on<HTMLButtonElement, "click">("click", () =>
										onChange(script.filter((_, i) => i !== index)),
									),
								]}
							>
								×
							</button>
						</div>
						<ScriptCommandFields command={command} onChange={(next) => update(index, next)} />
					</div>
				))}
				<div mix={css({ display: "flex", flexWrap: "wrap", gap: "0.3rem" })}>
					{SCRIPT_COMMANDS.map((entry) => (
						<button
							key={entry.id}
							type="button"
							mix={[
								css({ ...CONTROL_BUTTON, padding: "0.2rem 0.5rem", fontSize: "0.72rem" }),
								on<HTMLButtonElement, "click">("click", () => append(entry.id)),
							]}
						>
							+ {entry.label}
						</button>
					))}
				</div>
			</div>
		);
	};
}

/** Props for one script command's editable fields. */
interface ScriptCommandFieldsProps {
	/** The command whose fields are edited. */
	command: ScriptCommand;
	/** Called with the updated command. */
	onChange: (command: ScriptCommand) => void;
}

/**
 * Renders the editable fields for one script command, per its `do` discriminant.
 * Only the four builder-exposed commands have fields here; any other command shows
 * a read-only note.
 *
 * @param handle Component handle exposing the command props.
 * @returns The render function for one command's fields.
 */
function ScriptCommandFields(handle: Handle<ScriptCommandFieldsProps>) {
	return () => {
		let { command, onChange } = handle.props;
		if (command.do === "message") {
			return (
				<textarea
					value={command.text}
					placeholder="Message text"
					rows={2}
					mix={[
						css({ ...FIELD, resize: "vertical" }),
						on<HTMLTextAreaElement, "change">("change", (e) => {
							onChange({ do: "message", text: (e.target as HTMLTextAreaElement).value });
						}),
					]}
				/>
			);
		}
		if (command.do === "start-trainer-battle") {
			return (
				<input
					type="text"
					value={command.trainerId}
					placeholder="trainer id"
					mix={[
						css(FIELD),
						on<HTMLInputElement, "change">("change", (e) => {
							onChange({
								do: "start-trainer-battle",
								trainerId: (e.target as HTMLInputElement).value,
							});
						}),
					]}
				/>
			);
		}
		if (command.do === "set-flag") {
			return (
				<input
					type="text"
					value={command.flag}
					placeholder="flag name"
					mix={[
						css(FIELD),
						on<HTMLInputElement, "change">("change", (e) => {
							onChange({ do: "set-flag", flag: (e.target as HTMLInputElement).value });
						}),
					]}
				/>
			);
		}
		if (command.do === "warp") {
			let warp = command;
			return (
				<div mix={css({ display: "flex", flexWrap: "wrap", gap: "0.3rem" })}>
					<input
						type="text"
						value={warp.toMap}
						placeholder="to map"
						mix={[
							css({ ...FIELD, width: "100%" }),
							on<HTMLInputElement, "change">("change", (e) => {
								onChange({ ...warp, toMap: (e.target as HTMLInputElement).value });
							}),
						]}
					/>
					<input
						type="number"
						min="0"
						value={String(warp.toX)}
						title="to x"
						mix={[
							css({ ...FIELD, width: "4rem" }),
							on<HTMLInputElement, "change">("change", (e) => {
								onChange({ ...warp, toX: Number((e.target as HTMLInputElement).value) });
							}),
						]}
					/>
					<input
						type="number"
						min="0"
						value={String(warp.toY)}
						title="to y"
						mix={[
							css({ ...FIELD, width: "4rem" }),
							on<HTMLInputElement, "change">("change", (e) => {
								onChange({ ...warp, toY: Number((e.target as HTMLInputElement).value) });
							}),
						]}
					/>
				</div>
			);
		}
		return <span mix={css({ fontSize: "0.72rem", color: "#9ca3af" })}>(no editable fields)</span>;
	};
}

/** The wild block shape a `wild` event carries in its interaction (schema-derived). */
type WildBlock = NonNullable<MapEvent["interaction"]["wild"]>;

/** Props for the wild-encounter editor. */
interface WildEditorProps {
	/** The current wild block, or null. */
	wild: WildBlock | null;
	/** Called with the updated wild block, or null to clear it. */
	onChange: (wild: WildBlock | undefined) => void;
}

/**
 * Editor for a `wild` event's fixed encounter: a species (from the roster) and a
 * level. Clearing the species removes the wild block entirely.
 *
 * @param handle Component handle exposing the wild props.
 * @returns The render function for the wild editor.
 */
function WildEditor(handle: Handle<WildEditorProps>) {
	return () => {
		let { wild, onChange } = handle.props;
		let current = wild ?? { speciesId: SPECIES_IDS[0] ?? "", level: 5 };
		return (
			<div mix={css({ display: "flex", gap: "0.4rem", alignItems: "flex-end" })}>
				<label mix={LABEL}>
					Wild species
					<select
						value={current.speciesId}
						mix={[
							css(FIELD),
							on<HTMLSelectElement, "change">("change", (e) => {
								onChange({
									speciesId: (e.target as HTMLSelectElement).value,
									level: current.level,
								});
							}),
						]}
					>
						{SPECIES_IDS.map((id) => (
							<option key={id} value={id} selected={current.speciesId === id}>
								{id}
							</option>
						))}
					</select>
				</label>
				<label mix={LABEL}>
					Level
					<input
						type="number"
						min="1"
						value={String(current.level)}
						mix={[
							css({ ...FIELD, width: "4.5rem" }),
							on<HTMLInputElement, "change">("change", (e) => {
								onChange({
									speciesId: current.speciesId,
									level: Math.max(1, Math.trunc(Number((e.target as HTMLInputElement).value))),
								});
							}),
						]}
					/>
				</label>
			</div>
		);
	};
}

/** The trainer block shape an `npc` trainer event carries (schema-derived). */
type TrainerBlock = NonNullable<MapEvent["interaction"]["trainer"]>;

/** Props for the trainer-party editor. */
interface TrainerEditorProps {
	/** The current trainer block, or null when the NPC is not a trainer. */
	trainer: TrainerBlock | null;
	/** Called with the updated trainer block, or undefined to clear it. */
	onChange: (trainer: TrainerBlock | undefined) => void;
}

/**
 * Editor for an `npc` event's trainer battle: an optional name and reward, plus an
 * ordered party of species+level members. Toggling the trainer on seeds an empty
 * party; toggling it off clears the block.
 *
 * @param handle Component handle exposing the trainer props.
 * @returns The render function for the trainer editor.
 */
function TrainerEditor(handle: Handle<TrainerEditorProps>) {
	return () => {
		let { trainer, onChange } = handle.props;
		if (trainer === null) {
			return (
				<button
					type="button"
					mix={[
						css({ ...CONTROL_BUTTON, justifySelf: "start" }),
						on<HTMLButtonElement, "click">("click", () =>
							onChange({ name: undefined, party: [], reward: undefined }),
						),
					]}
				>
					Make trainer
				</button>
			);
		}
		return (
			<div mix={css({ display: "grid", gap: "0.4rem" })}>
				<div mix={css({ display: "flex", justifyContent: "space-between", alignItems: "center" })}>
					<span mix={css({ fontSize: "0.8rem", color: "#9ca3af" })}>Trainer party</span>
					<button
						type="button"
						mix={[
							css({ ...CONTROL_BUTTON, padding: "0.1rem 0.4rem", fontSize: "0.72rem" }),
							on<HTMLButtonElement, "click">("click", () => onChange(undefined)),
						]}
					>
						Not a trainer
					</button>
				</div>
				<div mix={css({ display: "flex", gap: "0.4rem" })}>
					<input
						type="text"
						value={trainer.name ?? ""}
						placeholder="name"
						mix={[
							css({ ...FIELD, width: "60%" }),
							on<HTMLInputElement, "change">("change", (e) => {
								let name = (e.target as HTMLInputElement).value.trim();
								onChange({ ...trainer, name: name.length > 0 ? name : undefined });
							}),
						]}
					/>
					<input
						type="number"
						min="0"
						value={String(trainer.reward ?? 0)}
						title="reward"
						mix={[
							css({ ...FIELD, width: "40%" }),
							on<HTMLInputElement, "change">("change", (e) => {
								let reward = Math.max(0, Math.trunc(Number((e.target as HTMLInputElement).value)));
								onChange({ ...trainer, reward });
							}),
						]}
					/>
				</div>
				{trainer.party.map((member, index) => (
					<div key={index} mix={css({ display: "flex", gap: "0.4rem", alignItems: "flex-end" })}>
						<select
							value={member.speciesId}
							mix={[
								css({ ...FIELD, flex: "1" }),
								on<HTMLSelectElement, "change">("change", (e) => {
									let party = trainer.party.map((m, i) =>
										i === index ? { ...m, speciesId: (e.target as HTMLSelectElement).value } : m,
									);
									onChange({ ...trainer, party });
								}),
							]}
						>
							{SPECIES_IDS.map((id) => (
								<option key={id} value={id} selected={member.speciesId === id}>
									{id}
								</option>
							))}
						</select>
						<input
							type="number"
							min="1"
							value={String(member.level)}
							title="level"
							mix={[
								css({ ...FIELD, width: "4rem" }),
								on<HTMLInputElement, "change">("change", (e) => {
									let level = Math.max(1, Math.trunc(Number((e.target as HTMLInputElement).value)));
									let party = trainer.party.map((m, i) => (i === index ? { ...m, level } : m));
									onChange({ ...trainer, party });
								}),
							]}
						/>
						<button
							type="button"
							mix={[
								css({ ...CONTROL_BUTTON, padding: "0.2rem 0.45rem", fontSize: "0.72rem" }),
								on<HTMLButtonElement, "click">("click", () => {
									onChange({ ...trainer, party: trainer.party.filter((_, i) => i !== index) });
								}),
							]}
						>
							×
						</button>
					</div>
				))}
				<button
					type="button"
					mix={[
						css({
							...CONTROL_BUTTON,
							justifySelf: "start",
							padding: "0.2rem 0.5rem",
							fontSize: "0.72rem",
						}),
						on<HTMLButtonElement, "click">("click", () => {
							onChange({
								...trainer,
								party: [...trainer.party, { speciesId: SPECIES_IDS[0] ?? "", level: 5 }],
							});
						}),
					]}
				>
					+ Add member
				</button>
			</div>
		);
	};
}
