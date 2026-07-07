/**
 * State-holding editor for a map-in-progress, built on the canonical editor class
 * pattern. A plain class (no framework coupling) that owns ALL editor state: the
 * map id, its grid size (`width`/`height` in tiles, `tileWidth`/`tileHeight` in
 * pixels), the ordered `tilesets`, the three tile layers plus a collision grid,
 * the current layer/tool/selected-tile, and the ordered list of {@link MapEvent}s.
 * The view constructs it once in component setup and drives every gesture through
 * it; the class mutates the grids/events and the view re-renders from
 * {@link MapEditor.toMapData}.
 *
 * The grid math is kept pure and DOM-free so it is unit-testable without a canvas:
 * a cell index is `y * width + x`, a painted layer cell is a packed tile ref (see
 * {@link packTileRef}), and an empty cell is {@link EMPTY_CELL}. The editor only
 * enforces the structural bounds the format cares about (layers and collision are
 * always exactly `width * height` cells long, tile refs name a declared tileset)
 * so the in-progress state can never drift past what {@link MapDataSchema} accepts;
 * the export path re-validates the final map through `loadMap`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	EMPTY_CELL,
	type EventPage,
	type MapData,
	type MapEvent,
	packTileRef,
	type Tileset,
	TILESET_STRIDE,
} from "~/presentation/render/map-schema";
import { Collision } from "~/presentation/render/tilemap";

import type { TileCoord } from "../map-render";

import { clonePage, defaultPage } from "./event-page-editor";

/** The paintable tile layers, in back-to-front render order. */
export const TILE_LAYERS = ["ground", "decor", "overhead"] as const;

/** One of the three paintable tile layers. */
export type TileLayerName = (typeof TILE_LAYERS)[number];

/**
 * The active editing target: one of the three tile layers, or the collision grid.
 * Painting a tile layer packs the selected tile ref; painting `collision` writes a
 * {@link Collision} value instead.
 */
export type EditLayer = TileLayerName | "collision";

/**
 * The map-editing tools. `paint` writes the selected tile (or collision value) to
 * the tile under the cursor, `erase` clears a tile-layer cell to {@link EMPTY_CELL}
 * (or collision to walkable), `fill` flood-fills the contiguous same-value region,
 * `rectangle`/`ellipse` press-drag a shape then fill every cell it covers on
 * release, `select` press-drags a rectangular region to copy/cut/paste, and `event`
 * places/selects an event marker rather than painting.
 */
export type MapTool = "paint" | "erase" | "fill" | "rectangle" | "ellipse" | "select" | "event";

/** The collision values the collision tool can paint, mapped to their meanings. */
export const COLLISION_VALUES = {
	walkable: Collision.Walkable,
	solid: Collision.Solid,
	water: Collision.Water,
	ledge: Collision.LedgeDown,
} as const;

/** One paintable collision kind (a key of {@link COLLISION_VALUES}). */
export type CollisionKind = keyof typeof COLLISION_VALUES;

/** The currently selected tile: which tileset it is from and its tile index. */
export interface TileSelection {
	/** Index into the map's `tilesets` array. */
	tilesetIndex: number;
	/** Zero-based tile index within that tileset's grid. */
	tileIndex: number;
}

/**
 * A rectangular region of tiles, normalized so `x`/`y` is the top-left corner and
 * `width`/`height` are always positive. Both {@link MapEditor.select} and the
 * rectangle/ellipse fills describe their extent with one of these.
 */
export interface TileRegion {
	/** Left column of the region (inclusive). */
	x: number;
	/** Top row of the region (inclusive). */
	y: number;
	/** Region width in tiles (>= 1). */
	width: number;
	/** Region height in tiles (>= 1). */
	height: number;
}

/**
 * A copied rectangular block of a single layer/grid: its `width`×`height` in tiles
 * and the flat `width * height` array of cell values captured from the source (row
 * by row). Pasting stamps this block at an anchor, clipping any cell that would land
 * off-map.
 */
export interface RegionBlock {
	/** Block width in tiles. */
	width: number;
	/** Block height in tiles. */
	height: number;
	/** The captured cells, row-major (`row * width + col`). */
	cells: number[];
}

/**
 * Normalizes two drag endpoints (in either order) into a {@link TileRegion} with a
 * positive size, so a rectangle/ellipse/selection is the same regardless of drag
 * direction. Pure: the coordinates are used as-is (callers clamp to the map).
 *
 * @param x0 One corner's column.
 * @param y0 One corner's row.
 * @param x1 The opposite corner's column.
 * @param y1 The opposite corner's row.
 */
export function normalizeRegion(x0: number, y0: number, x1: number, y1: number): TileRegion {
	let minX = Math.min(x0, x1);
	let minY = Math.min(y0, y1);
	let maxX = Math.max(x0, x1);
	let maxY = Math.max(y0, y1);
	return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Every tile coordinate covered by the inclusive rectangle spanning two drag
 * endpoints, in row-major order. The bounds are inclusive of both endpoints and the
 * result is identical regardless of which corner the drag started from. Pure and
 * DOM-free so the fill and its tests share the exact geometry.
 *
 * @param x0 One corner's column.
 * @param y0 One corner's row.
 * @param x1 The opposite corner's column.
 * @param y1 The opposite corner's row.
 */
export function rectCells(x0: number, y0: number, x1: number, y1: number): TileCoord[] {
	let region = normalizeRegion(x0, y0, x1, y1);
	let cells: TileCoord[] = [];
	for (let y = region.y; y < region.y + region.height; y++) {
		for (let x = region.x; x < region.x + region.width; x++) {
			cells.push({ x, y });
		}
	}
	return cells;
}

/**
 * Every tile coordinate inside the ellipse inscribed in the inclusive rectangle
 * spanning two drag endpoints, in row-major order. A cell is inside when its center
 * satisfies the ellipse equation for the region's half-extents; a 1×N or N×1 drag
 * degenerates to the full rectangle (the ellipse fills its bounding line). Pure and
 * DOM-free so the fill and its tests share the exact geometry.
 *
 * @param x0 One corner's column.
 * @param y0 One corner's row.
 * @param x1 The opposite corner's column.
 * @param y1 The opposite corner's row.
 */
export function ellipseCells(x0: number, y0: number, x1: number, y1: number): TileCoord[] {
	let region = normalizeRegion(x0, y0, x1, y1);
	// Half-extents and center of the inscribed ellipse, in tile units.
	let radiusX = region.width / 2;
	let radiusY = region.height / 2;
	let centerX = region.x + radiusX - 0.5;
	let centerY = region.y + radiusY - 0.5;
	let cells: TileCoord[] = [];
	for (let y = region.y; y < region.y + region.height; y++) {
		for (let x = region.x; x < region.x + region.width; x++) {
			// A degenerate axis (radius 0) never divides; that axis contributes 0 so the
			// whole 1-wide/1-tall line counts as inside.
			let normX = radiusX === 0 ? 0 : (x - centerX) / radiusX;
			let normY = radiusY === 0 ? 0 : (y - centerY) / radiusY;
			if (normX * normX + normY * normY <= 1) cells.push({ x, y });
		}
	}
	return cells;
}

/**
 * Copies a rectangular region out of a flat grid into a {@link RegionBlock}, reading
 * each cell (or `outside` for a coordinate past the grid bounds so a region dragged
 * over an edge still yields a full block). Pure: the source grid is only read.
 *
 * @param grid The source flat grid, `gridWidth * gridHeight` cells.
 * @param gridWidth The source width in cells.
 * @param gridHeight The source height in cells.
 * @param region The rectangular region to copy.
 * @param outside The value to record for a cell outside the grid bounds.
 */
export function copyRegion(
	grid: number[],
	gridWidth: number,
	gridHeight: number,
	region: TileRegion,
	outside: number,
): RegionBlock {
	let cells: number[] = [];
	for (let row = 0; row < region.height; row++) {
		for (let col = 0; col < region.width; col++) {
			let x = region.x + col;
			let y = region.y + row;
			let inBounds = x >= 0 && y >= 0 && x < gridWidth && y < gridHeight;
			cells.push(inBounds ? grid[y * gridWidth + x]! : outside);
		}
	}
	return { width: region.width, height: region.height, cells };
}

/**
 * Stamps a {@link RegionBlock} into a flat grid at an anchor (its top-left corner),
 * clipping any cell that would land outside the grid. Pure: it returns a new grid
 * rather than mutating the input, so the editor can swap the whole layer in.
 *
 * @param grid The destination flat grid, `gridWidth * gridHeight` cells.
 * @param gridWidth The destination width in cells.
 * @param gridHeight The destination height in cells.
 * @param block The block to stamp.
 * @param anchorX The column the block's left edge lands on.
 * @param anchorY The row the block's top edge lands on.
 */
export function pasteRegion(
	grid: number[],
	gridWidth: number,
	gridHeight: number,
	block: RegionBlock,
	anchorX: number,
	anchorY: number,
): number[] {
	let next = [...grid];
	for (let row = 0; row < block.height; row++) {
		for (let col = 0; col < block.width; col++) {
			let x = anchorX + col;
			let y = anchorY + row;
			if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) continue;
			next[y * gridWidth + x] = block.cells[row * block.width + col]!;
		}
	}
	return next;
}

/** Default map width in tiles when a fresh map is created. */
export const DEFAULT_MAP_WIDTH = 20;

/** Default map height in tiles when a fresh map is created. */
export const DEFAULT_MAP_HEIGHT = 15;

/** Default tile size in pixels for a fresh map (matches the game's tile size). */
export const DEFAULT_TILE_SIZE = 16;

/** Upper bound on a map dimension in tiles, keeping arrays and the JSON sane. */
export const MAX_MAP_DIMENSION = 256;

/** Smallest zoom factor the map canvas renders at (one screen pixel per source pixel). */
export const MIN_ZOOM = 1;

/** Largest zoom factor the map canvas renders at, keeping the canvas bitmap sane. */
export const MAX_ZOOM = 8;

/** The zoom the editor starts at and returns to when reset. */
export const DEFAULT_ZOOM = 2;

/** Per-layer visibility flags: whether each tile layer is drawn on the canvas. */
export type LayerVisibility = Record<TileLayerName, boolean>;

/**
 * Clamps a zoom factor to a whole number in `MIN_ZOOM..=MAX_ZOOM`. Kept module-level
 * and pure so the render helper and its tests can reuse the exact clamp the editor
 * enforces. A non-finite input falls back to {@link MIN_ZOOM}.
 */
export function clampZoom(value: number): number {
	let whole = Number.isFinite(value) ? Math.trunc(value) : MIN_ZOOM;
	return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, whole));
}

/**
 * Editor for a single map definition. Wraps the mutable grid/tileset/event state
 * behind pure mutation methods; {@link toMapData} serializes the current state to
 * a JSON-clean {@link MapData} the export path validates and writes.
 */
export class MapEditor {
	/** Stable identifier the export path derives the write filename from. */
	#id: string;

	/** Map width in tiles. */
	#width: number;

	/** Map height in tiles. */
	#height: number;

	/** Tile width in pixels (the packed layers and renderer share this). */
	#tileWidth: number;

	/** Tile height in pixels. */
	#tileHeight: number;

	/** The declared tilesets, in order; a packed tile ref's index names one. */
	#tilesets: Tileset[];

	/** The three tile layers by name, each a flat `width * height` cell array. */
	#layers: Record<TileLayerName, number[]>;

	/** The collision grid, a flat `width * height` array of {@link Collision} values. */
	#collision: number[];

	/** The ordered map events. */
	#events: MapEvent[];

	/** Background music track id (a manifest audio id), empty for none. */
	#bgm: string;

	/** The active editing layer (a tile layer or the collision grid). */
	#layer: EditLayer = "ground";

	/** The active tool. */
	#tool: MapTool = "paint";

	/** The currently selected tile the paint tool writes. */
	#selection: TileSelection = { tilesetIndex: 0, tileIndex: 0 };

	/** The collision kind the collision tool paints. */
	#collisionKind: CollisionKind = "solid";

	/** Integer zoom factor the view blits the map canvas at. */
	#zoom: number = DEFAULT_ZOOM;

	/** Per-layer visibility flags; a hidden layer is skipped when drawing. */
	#layerVisibility: LayerVisibility = { ground: true, decor: true, overhead: true };

	/** Whether the tile grid is stroked over the map canvas. */
	#showGrid: boolean = true;

	/** Whether the collision overlay is always shown (not just on the collision layer). */
	#showCollision: boolean = false;

	/** The current rectangular selection (a copy is exposed), or `null` when none. */
	#selectionRegion: TileRegion | null = null;

	/**
	 * The last copied/cut block, or `null` when the clipboard is empty. A block is
	 * captured from whichever layer/grid was active at copy time; pasting stamps it
	 * onto the currently active layer/grid.
	 */
	#clipboard: RegionBlock | null = null;

	/**
	 * @param options Optional initial id and dimensions; omitted fields fall back to
	 *   the module defaults so a fresh editor starts on a sensible empty map.
	 */
	constructor(options?: {
		id?: string;
		width?: number;
		height?: number;
		tileWidth?: number;
		tileHeight?: number;
	}) {
		this.#id = options?.id ?? "";
		this.#width = clampDimension(options?.width ?? DEFAULT_MAP_WIDTH);
		this.#height = clampDimension(options?.height ?? DEFAULT_MAP_HEIGHT);
		this.#tileWidth = clampTileSize(options?.tileWidth ?? DEFAULT_TILE_SIZE);
		this.#tileHeight = clampTileSize(options?.tileHeight ?? DEFAULT_TILE_SIZE);
		this.#tilesets = [];
		this.#layers = {
			ground: emptyLayer(this.#width, this.#height),
			decor: emptyLayer(this.#width, this.#height),
			overhead: emptyLayer(this.#width, this.#height),
		};
		this.#collision = walkableGrid(this.#width, this.#height);
		this.#events = [];
		this.#bgm = "";
	}

	/** Map id (trimmed on serialization). */
	get id(): string {
		return this.#id;
	}

	/** Map width in tiles. */
	get width(): number {
		return this.#width;
	}

	/** Map height in tiles. */
	get height(): number {
		return this.#height;
	}

	/** Tile width in pixels. */
	get tileWidth(): number {
		return this.#tileWidth;
	}

	/** Tile height in pixels. */
	get tileHeight(): number {
		return this.#tileHeight;
	}

	/** Background music track id. */
	get bgm(): string {
		return this.#bgm;
	}

	/** The active editing layer. */
	get layer(): EditLayer {
		return this.#layer;
	}

	/** The active tool. */
	get tool(): MapTool {
		return this.#tool;
	}

	/** The currently selected tile (a copy). */
	get selection(): TileSelection {
		return { ...this.#selection };
	}

	/** The collision kind the collision tool paints. */
	get collisionKind(): CollisionKind {
		return this.#collisionKind;
	}

	/** The current integer zoom factor the map canvas blits at. */
	get zoom(): number {
		return this.#zoom;
	}

	/** The per-layer visibility flags (a copy, so callers cannot mutate the internal). */
	get layerVisibility(): LayerVisibility {
		return { ...this.#layerVisibility };
	}

	/** Whether the tile grid is stroked over the map canvas. */
	get showGrid(): boolean {
		return this.#showGrid;
	}

	/** Whether the collision overlay is drawn regardless of the active layer. */
	get showCollision(): boolean {
		return this.#showCollision;
	}

	/** The current rectangular selection (a copy), or `null` when nothing is selected. */
	get selectionRegion(): TileRegion | null {
		return this.#selectionRegion ? { ...this.#selectionRegion } : null;
	}

	/** Whether the clipboard holds a copied/cut block that {@link paste} can stamp. */
	get hasClipboard(): boolean {
		return this.#clipboard !== null;
	}

	/** Whether a tile layer is currently drawn (visible). */
	isLayerVisible(name: TileLayerName): boolean {
		return this.#layerVisibility[name];
	}

	/** The declared tilesets, in order (copies, so callers cannot mutate them). */
	get tilesets(): Tileset[] {
		return this.#tilesets.map((tileset) => ({ ...tileset }));
	}

	/** The current event list (copies, so callers cannot mutate the internals). */
	get events(): MapEvent[] {
		return this.#events.map((event) => cloneEvent(event));
	}

	/** Number of cells in each layer (`width * height`). */
	get cellCount(): number {
		return this.#width * this.#height;
	}

	/** Sets the map id and returns this editor for chaining. */
	setId(id: string): this {
		this.#id = id;
		return this;
	}

	/** Sets the background music track id (trimmed on serialization). */
	setBgm(bgm: string): this {
		this.#bgm = bgm;
		return this;
	}

	/**
	 * Recreates the map at a new size and tile size, clearing every layer, the
	 * collision grid (to walkable), and dropping every event. Use when starting a
	 * fresh map; {@link resize} preserves content instead.
	 *
	 * @param width New width in tiles.
	 * @param height New height in tiles.
	 * @param tileWidth New tile width in pixels.
	 * @param tileHeight New tile height in pixels.
	 */
	createMap(
		width: number,
		height: number,
		tileWidth: number = this.#tileWidth,
		tileHeight: number = this.#tileHeight,
	): this {
		this.#width = clampDimension(width);
		this.#height = clampDimension(height);
		this.#tileWidth = clampTileSize(tileWidth);
		this.#tileHeight = clampTileSize(tileHeight);
		this.#layers = {
			ground: emptyLayer(this.#width, this.#height),
			decor: emptyLayer(this.#width, this.#height),
			overhead: emptyLayer(this.#width, this.#height),
		};
		this.#collision = walkableGrid(this.#width, this.#height);
		this.#events = [];
		this.#selectionRegion = null;
		return this;
	}

	/**
	 * Resizes the map to a new tile size, preserving the overlapping top-left region
	 * of every layer and the collision grid. Cells outside the old bounds are empty
	 * (tile layers) or walkable (collision); events beyond the new bounds are
	 * dropped so no event ever sits off-map.
	 *
	 * @param width New width in tiles.
	 * @param height New height in tiles.
	 */
	resize(width: number, height: number): this {
		let nextWidth = clampDimension(width);
		let nextHeight = clampDimension(height);

		for (let name of TILE_LAYERS) {
			this.#layers[name] = resizeGrid(
				this.#layers[name],
				this.#width,
				this.#height,
				nextWidth,
				nextHeight,
				EMPTY_CELL,
			);
		}
		this.#collision = resizeGrid(
			this.#collision,
			this.#width,
			this.#height,
			nextWidth,
			nextHeight,
			Collision.Walkable,
		);

		this.#width = nextWidth;
		this.#height = nextHeight;
		this.#events = this.#events.filter((event) => this.#inBounds(event.x, event.y));
		// A selection made against the old bounds may now be off-map; drop it.
		this.#selectionRegion = null;
		return this;
	}

	/** True when a tile coordinate is inside the map. */
	#inBounds(x: number, y: number): boolean {
		return x >= 0 && y >= 0 && x < this.#width && y < this.#height;
	}

	/**
	 * Adds a tileset declaration to the end of the list and returns its index. The
	 * new tileset does not disturb existing packed refs (they keep their index).
	 *
	 * @param tileset The tileset declaration (image id, columns, tile size).
	 * @returns The index the tileset was added at.
	 */
	addTileset(tileset: Tileset): number {
		this.#tilesets.push({ ...tileset });
		return this.#tilesets.length - 1;
	}

	/**
	 * Removes the tileset at `index`, clearing every layer cell that referenced it
	 * and shifting refs to later tilesets down by one so the remaining refs stay
	 * valid. A no-op for an out-of-range index.
	 *
	 * @param index The tileset index to remove.
	 */
	removeTileset(index: number): this {
		if (index < 0 || index >= this.#tilesets.length) return this;
		this.#tilesets.splice(index, 1);

		for (let name of TILE_LAYERS) {
			let layer = this.#layers[name];
			for (let cell = 0; cell < layer.length; cell++) {
				let value = layer[cell]!;
				if (value === EMPTY_CELL) continue;
				let tilesetIndex = Math.floor(value / TILESET_STRIDE);
				let tileIndex = value % TILESET_STRIDE;
				if (tilesetIndex === index) layer[cell] = EMPTY_CELL;
				else if (tilesetIndex > index) layer[cell] = packTileRef(tilesetIndex - 1, tileIndex);
			}
		}

		// Keep the selection pointing at a valid tileset (or reset it).
		if (this.#selection.tilesetIndex === index) {
			this.#selection = { tilesetIndex: 0, tileIndex: 0 };
		} else if (this.#selection.tilesetIndex > index) {
			this.#selection = {
				tilesetIndex: this.#selection.tilesetIndex - 1,
				tileIndex: this.#selection.tileIndex,
			};
		}
		return this;
	}

	/** Sets the active editing layer (a tile layer or the collision grid). */
	setLayer(layer: EditLayer): this {
		this.#layer = layer;
		return this;
	}

	/** Sets the active tool. */
	setTool(tool: MapTool): this {
		this.#tool = tool;
		return this;
	}

	/** Sets the collision kind the collision tool paints. */
	setCollisionKind(kind: CollisionKind): this {
		this.#collisionKind = kind;
		return this;
	}

	/** Sets the zoom factor, clamped to `MIN_ZOOM..=MAX_ZOOM` (whole steps). */
	setZoom(zoom: number): this {
		this.#zoom = clampZoom(zoom);
		return this;
	}

	/** Steps the zoom in (`+1`) or out (`-1`) by one whole factor, clamped. */
	stepZoom(delta: number): this {
		this.#zoom = clampZoom(this.#zoom + Math.sign(delta));
		return this;
	}

	/** Sets whether a tile layer is drawn on the canvas. */
	setLayerVisible(name: TileLayerName, visible: boolean): this {
		this.#layerVisibility = { ...this.#layerVisibility, [name]: visible };
		return this;
	}

	/** Toggles a tile layer's visibility and returns the new visibility. */
	toggleLayer(name: TileLayerName): boolean {
		let next = !this.#layerVisibility[name];
		this.#layerVisibility = { ...this.#layerVisibility, [name]: next };
		return next;
	}

	/** Sets whether the tile grid is stroked over the map canvas. */
	setShowGrid(show: boolean): this {
		this.#showGrid = show;
		return this;
	}

	/** Toggles the tile grid and returns the new state. */
	toggleGrid(): boolean {
		this.#showGrid = !this.#showGrid;
		return this.#showGrid;
	}

	/** Sets whether the collision overlay is drawn regardless of the active layer. */
	setShowCollision(show: boolean): this {
		this.#showCollision = show;
		return this;
	}

	/** Toggles the always-on collision overlay and returns the new state. */
	toggleCollision(): boolean {
		this.#showCollision = !this.#showCollision;
		return this.#showCollision;
	}

	/**
	 * Selects the tile the paint tool writes: a tileset index and a tile index
	 * within it. Ignores a tileset index that names no declared tileset.
	 *
	 * @param tilesetIndex Which declared tileset the tile is from.
	 * @param tileIndex The zero-based tile index within that tileset.
	 */
	selectTile(tilesetIndex: number, tileIndex: number): this {
		if (tilesetIndex < 0 || tilesetIndex >= this.#tilesets.length) return this;
		if (!Number.isInteger(tileIndex) || tileIndex < 0) return this;
		this.#selection = { tilesetIndex, tileIndex };
		return this;
	}

	/**
	 * Reads one tile-layer cell (`-1` empty, else a packed tile ref), or
	 * {@link EMPTY_CELL} for an out-of-bounds coordinate.
	 *
	 * @param name The tile layer to read.
	 * @param x Tile column.
	 * @param y Tile row.
	 */
	cellAt(name: TileLayerName, x: number, y: number): number {
		if (!this.#inBounds(x, y)) return EMPTY_CELL;
		return this.#layers[name][y * this.#width + x]!;
	}

	/**
	 * Reads one collision cell, or {@link Collision.Walkable} for an out-of-bounds
	 * coordinate.
	 *
	 * @param x Tile column.
	 * @param y Tile row.
	 */
	collisionAt(x: number, y: number): number {
		if (!this.#inBounds(x, y)) return Collision.Walkable;
		return this.#collision[y * this.#width + x]!;
	}

	/**
	 * Sets one tile-layer cell to a packed tile ref, or {@link EMPTY_CELL} to clear
	 * it. A no-op for an out-of-bounds coordinate, or a ref that names an undeclared
	 * tileset (so a layer can never reference a missing tileset).
	 *
	 * @param name The tile layer to write.
	 * @param x Tile column.
	 * @param y Tile row.
	 * @param value A packed tile ref (see {@link packTileRef}) or {@link EMPTY_CELL}.
	 */
	setCell(name: TileLayerName, x: number, y: number, value: number): this {
		if (!this.#inBounds(x, y)) return this;
		if (value !== EMPTY_CELL) {
			let tilesetIndex = Math.floor(value / TILESET_STRIDE);
			if (tilesetIndex < 0 || tilesetIndex >= this.#tilesets.length) return this;
		}
		this.#layers[name][y * this.#width + x] = value;
		return this;
	}

	/**
	 * Paints the currently selected tile onto a tile layer at a coordinate, packing
	 * the ref. A no-op when no tileset is declared or the coordinate is off-map.
	 *
	 * @param name The tile layer to paint.
	 * @param x Tile column.
	 * @param y Tile row.
	 */
	paintTile(name: TileLayerName, x: number, y: number): this {
		if (this.#tilesets.length === 0) return this;
		return this.setCell(
			name,
			x,
			y,
			packTileRef(this.#selection.tilesetIndex, this.#selection.tileIndex),
		);
	}

	/**
	 * Clears one tile-layer cell to {@link EMPTY_CELL}.
	 *
	 * @param name The tile layer to erase.
	 * @param x Tile column.
	 * @param y Tile row.
	 */
	eraseTile(name: TileLayerName, x: number, y: number): this {
		return this.setCell(name, x, y, EMPTY_CELL);
	}

	/**
	 * Paints a {@link Collision} value onto the collision grid. A no-op for an
	 * out-of-bounds coordinate.
	 *
	 * @param x Tile column.
	 * @param y Tile row.
	 * @param value The collision value to write.
	 */
	paintCollision(x: number, y: number, value: number): this {
		if (!this.#inBounds(x, y)) return this;
		this.#collision[y * this.#width + x] = value;
		return this;
	}

	/**
	 * Flood-fills the contiguous region of same-valued cells reachable from a seed
	 * with `value`, on the given layer/grid. Works on a tile layer (packed refs) or
	 * the collision grid; a no-op when the seed already holds `value` or is
	 * off-map. Returns the number of cells changed.
	 *
	 * @param name The layer or grid to fill (a tile layer or `"collision"`).
	 * @param x Seed tile column.
	 * @param y Seed tile row.
	 * @param value The value to fill with (a packed ref/`-1`, or a collision value).
	 */
	fill(name: EditLayer, x: number, y: number, value: number): number {
		if (!this.#inBounds(x, y)) return 0;
		let grid = name === "collision" ? this.#collision : this.#layers[name];
		let seed = grid[y * this.#width + x]!;
		if (seed === value) return 0;

		let changed = 0;
		let stack: Array<[number, number]> = [[x, y]];
		while (stack.length > 0) {
			let [cx, cy] = stack.pop()!;
			if (!this.#inBounds(cx, cy)) continue;
			let index = cy * this.#width + cx;
			if (grid[index] !== seed) continue;
			grid[index] = value;
			changed++;
			stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
		}
		return changed;
	}

	/**
	 * Fills a tile layer with the currently selected tile from a seed. A no-op when
	 * no tileset is declared. Returns the number of cells changed.
	 *
	 * @param name The tile layer to fill.
	 * @param x Seed tile column.
	 * @param y Seed tile row.
	 */
	fillTile(name: TileLayerName, x: number, y: number): number {
		if (this.#tilesets.length === 0) return 0;
		return this.fill(
			name,
			x,
			y,
			packTileRef(this.#selection.tilesetIndex, this.#selection.tileIndex),
		);
	}

	/**
	 * The value the rectangle/ellipse tools write on the active layer/grid: the packed
	 * selected ref for a tile layer, or the active collision kind for the collision
	 * grid. `null` when a tile layer is active but no tileset is declared (nothing to
	 * paint), so callers can no-op.
	 */
	#brushValue(): number | null {
		if (this.#layer === "collision") return COLLISION_VALUES[this.#collisionKind];
		if (this.#tilesets.length === 0) return null;
		return packTileRef(this.#selection.tilesetIndex, this.#selection.tileIndex);
	}

	/**
	 * Fills every tile the rectangle spanning two drag endpoints covers with the
	 * active brush (the selected tile on a tile layer, or the collision kind on the
	 * collision grid). Cells outside the map are skipped and a tile-layer fill with no
	 * tileset declared is a no-op. Returns the number of cells changed.
	 *
	 * @param x0 One drag-corner column.
	 * @param y0 One drag-corner row.
	 * @param x1 The opposite drag-corner column.
	 * @param y1 The opposite drag-corner row.
	 */
	rectangle(x0: number, y0: number, x1: number, y1: number): number {
		return this.#fillCells(rectCells(x0, y0, x1, y1));
	}

	/**
	 * Fills every tile the ellipse inscribed in the drag rectangle covers with the
	 * active brush (see {@link rectangle} for the value chosen and no-op rules).
	 * Returns the number of cells changed.
	 *
	 * @param x0 One drag-corner column.
	 * @param y0 One drag-corner row.
	 * @param x1 The opposite drag-corner column.
	 * @param y1 The opposite drag-corner row.
	 */
	ellipse(x0: number, y0: number, x1: number, y1: number): number {
		return this.#fillCells(ellipseCells(x0, y0, x1, y1));
	}

	/** Writes the active brush into every in-bounds cell of a coordinate list. */
	#fillCells(cells: TileCoord[]): number {
		let value = this.#brushValue();
		if (value === null) return 0;
		let grid = this.#layer === "collision" ? this.#collision : this.#layers[this.#layer];
		let changed = 0;
		for (let cell of cells) {
			if (!this.#inBounds(cell.x, cell.y)) continue;
			grid[cell.y * this.#width + cell.x] = value;
			changed++;
		}
		return changed;
	}

	/**
	 * Records a rectangular selection spanning two drag endpoints, normalized so it is
	 * the same regardless of drag direction and clamped to the map bounds. The
	 * selection is what {@link copySelection} / {@link cutSelection} grab; it does not
	 * itself change any cell. Returns the stored selection (a copy).
	 *
	 * @param x0 One drag-corner column.
	 * @param y0 One drag-corner row.
	 * @param x1 The opposite drag-corner column.
	 * @param y1 The opposite drag-corner row.
	 */
	select(x0: number, y0: number, x1: number, y1: number): TileRegion {
		let region = normalizeRegion(x0, y0, x1, y1);
		// Clamp to the map so a selection never extends past an edge.
		let minX = Math.max(0, region.x);
		let minY = Math.max(0, region.y);
		let maxX = Math.min(this.#width - 1, region.x + region.width - 1);
		let maxY = Math.min(this.#height - 1, region.y + region.height - 1);
		this.#selectionRegion = {
			x: minX,
			y: minY,
			width: Math.max(1, maxX - minX + 1),
			height: Math.max(1, maxY - minY + 1),
		};
		return { ...this.#selectionRegion };
	}

	/** Clears the current selection (without touching the clipboard). */
	clearSelection(): this {
		this.#selectionRegion = null;
		return this;
	}

	/**
	 * Copies the current selection's cells from the active layer/grid into the
	 * clipboard, ready for {@link paste}. A no-op returning `null` when nothing is
	 * selected. The copied block records the layer's raw cell values (empty cells and
	 * walkable collision included) so a paste reproduces the region exactly.
	 *
	 * @returns The captured block (a copy), or `null` when there is no selection.
	 */
	copySelection(): RegionBlock | null {
		if (this.#selectionRegion === null) return null;
		let outside = this.#layer === "collision" ? Collision.Walkable : EMPTY_CELL;
		let grid = this.#layer === "collision" ? this.#collision : this.#layers[this.#layer];
		let block = copyRegion(grid, this.#width, this.#height, this.#selectionRegion, outside);
		this.#clipboard = { width: block.width, height: block.height, cells: [...block.cells] };
		return { width: block.width, height: block.height, cells: [...block.cells] };
	}

	/**
	 * Copies the current selection into the clipboard, then clears every selected cell
	 * on the active layer/grid (empty on a tile layer, walkable on collision). A no-op
	 * returning `null` when nothing is selected.
	 *
	 * @returns The captured block (a copy), or `null` when there is no selection.
	 */
	cutSelection(): RegionBlock | null {
		let block = this.copySelection();
		if (block === null || this.#selectionRegion === null) return block;
		let cleared = this.#layer === "collision" ? Collision.Walkable : EMPTY_CELL;
		let grid = this.#layer === "collision" ? this.#collision : this.#layers[this.#layer];
		for (let row = 0; row < this.#selectionRegion.height; row++) {
			for (let col = 0; col < this.#selectionRegion.width; col++) {
				let x = this.#selectionRegion.x + col;
				let y = this.#selectionRegion.y + row;
				if (this.#inBounds(x, y)) grid[y * this.#width + x] = cleared;
			}
		}
		return block;
	}

	/**
	 * Stamps the clipboard block onto the active layer/grid with its top-left corner
	 * at the anchor, clipping any cell that would land off-map. A no-op returning `0`
	 * when the clipboard is empty. Returns the number of cells stamped (in-bounds).
	 *
	 * @param anchorX The column the block's left edge lands on.
	 * @param anchorY The row the block's top edge lands on.
	 */
	paste(anchorX: number, anchorY: number): number {
		if (this.#clipboard === null) return 0;
		let grid = this.#layer === "collision" ? this.#collision : this.#layers[this.#layer];
		let next = pasteRegion(grid, this.#width, this.#height, this.#clipboard, anchorX, anchorY);
		if (this.#layer === "collision") this.#collision = next;
		else this.#layers[this.#layer] = next;
		// Count how many cells actually landed in bounds.
		let stamped = 0;
		for (let row = 0; row < this.#clipboard.height; row++) {
			for (let col = 0; col < this.#clipboard.width; col++) {
				let x = anchorX + col;
				let y = anchorY + row;
				if (this.#inBounds(x, y)) stamped++;
			}
		}
		return stamped;
	}

	/**
	 * Places a new event at a tile and returns it. The event is seeded with a
	 * generated unique id, a display name matching that id, and exactly one default
	 * {@link EventPage} (no conditions, no graphic, fixed movement, all options off,
	 * an `action` trigger, an empty command list) matching the RPG-Maker-XP model. A
	 * no-op returning `null` for an off-map coordinate.
	 *
	 * @param x Tile column.
	 * @param y Tile row.
	 * @returns The placed event (a copy), or `null` when off-map.
	 */
	addEvent(x: number, y: number): MapEvent | null {
		if (!this.#inBounds(x, y)) return null;
		let id = this.#uniqueEventId();
		let event: MapEvent = { id, x, y, name: id, pages: [defaultPage()] };
		this.#events.push(event);
		return cloneEvent(event);
	}

	/**
	 * Removes the event with the given id. A no-op for an unknown id.
	 *
	 * @param id The event id to remove.
	 */
	removeEvent(id: string): this {
		this.#events = this.#events.filter((event) => event.id !== id);
		return this;
	}

	/**
	 * Moves the event with the given id to a new tile. A no-op for an unknown id or
	 * an off-map destination.
	 *
	 * @param id The event id to move.
	 * @param x New tile column.
	 * @param y New tile row.
	 */
	moveEvent(id: string, x: number, y: number): this {
		if (!this.#inBounds(x, y)) return this;
		let event = this.#events.find((entry) => entry.id === id);
		if (event) {
			event.x = x;
			event.y = y;
		}
		return this;
	}

	/**
	 * Overwrites the event with the given id's identity/position/name and its whole
	 * page list from a patch, replacing only the provided fields. This is the commit
	 * point the event editor dialog uses to save a whole edited event at once (the
	 * dialog edits a working copy and hands back the final `pages`). A no-op for an
	 * unknown id. Returns the updated event (a copy) or `null`.
	 *
	 * @param id The event id to configure.
	 * @param patch The fields to overwrite on the event (`name`, `pages`, position…).
	 * @returns The updated event (a copy), or `null` for an unknown id.
	 */
	configureEvent(id: string, patch: Partial<MapEvent>): MapEvent | null {
		let event = this.#events.find((entry) => entry.id === id);
		if (!event) return null;
		if (patch.id !== undefined) event.id = patch.id;
		if (patch.x !== undefined && this.#inBounds(patch.x, event.y)) event.x = patch.x;
		if (patch.y !== undefined && this.#inBounds(event.x, patch.y)) event.y = patch.y;
		if ("name" in patch) event.name = patch.name;
		if (patch.pages !== undefined) {
			event.pages = patch.pages.length > 0 ? patch.pages.map(clonePage) : [defaultPage()];
		}
		return cloneEvent(event);
	}

	/**
	 * Replaces the whole page list of the event with the given id. A convenience over
	 * {@link configureEvent} for the dialog's save path; falls back to one default
	 * page when handed an empty list so an event is never page-less. A no-op for an
	 * unknown id. Returns the updated event (a copy) or `null`.
	 *
	 * @param id The event id whose pages to replace.
	 * @param pages The new page list (deep-copied in).
	 */
	setEventPages(id: string, pages: EventPage[]): MapEvent | null {
		return this.configureEvent(id, { pages });
	}

	/** Finds an event by id (a copy), or `null`. */
	findEvent(id: string): MapEvent | null {
		let event = this.#events.find((entry) => entry.id === id);
		return event ? cloneEvent(event) : null;
	}

	/** Finds an event by tile position (a copy), or `null`. */
	eventAt(x: number, y: number): MapEvent | null {
		let event = this.#events.find((entry) => entry.x === x && entry.y === y);
		return event ? cloneEvent(event) : null;
	}

	/**
	 * Serializes the current editor state to a JSON-clean {@link MapData}. The id
	 * and bgm are trimmed, and every nested value is a fresh copy so callers cannot
	 * mutate the editor's internal state through the snapshot. Encounters and warps
	 * are not authored in this editor yet and serialize empty.
	 *
	 * @returns The current map definition.
	 */
	toMapData(): MapData {
		return {
			id: this.#id.trim(),
			width: this.#width,
			height: this.#height,
			tileWidth: this.#tileWidth,
			tileHeight: this.#tileHeight,
			tilesets: this.#tilesets.map((tileset) => ({ ...tileset })),
			layers: {
				ground: [...this.#layers.ground],
				decor: [...this.#layers.decor],
				overhead: [...this.#layers.overhead],
			},
			collision: [...this.#collision],
			encounters: [],
			warps: [],
			events: this.#events.map((event) => cloneEvent(event)),
			bgm: this.#bgm.trim(),
		};
	}

	/** Generates an `event-N` id unique among the current events. */
	#uniqueEventId(): string {
		let taken = new Set(this.#events.map((event) => event.id));
		let n = this.#events.length + 1;
		let id = `event-${n}`;
		while (taken.has(id)) {
			n++;
			id = `event-${n}`;
		}
		return id;
	}
}

/** Clamps a map dimension to a whole number in `1..=MAX_MAP_DIMENSION`. */
function clampDimension(value: number): number {
	let whole = Number.isFinite(value) ? Math.trunc(value) : 1;
	return Math.max(1, Math.min(MAX_MAP_DIMENSION, whole));
}

/** Clamps a tile size to a whole number of at least 1 pixel. */
function clampTileSize(value: number): number {
	let whole = Number.isFinite(value) ? Math.trunc(value) : DEFAULT_TILE_SIZE;
	return Math.max(1, whole);
}

/** Builds a fresh `width * height` layer filled with {@link EMPTY_CELL}. */
function emptyLayer(width: number, height: number): number[] {
	return new Array<number>(width * height).fill(EMPTY_CELL);
}

/** Builds a fresh `width * height` collision grid, all walkable. */
function walkableGrid(width: number, height: number): number[] {
	return new Array<number>(width * height).fill(Collision.Walkable);
}

/**
 * Reshapes a flat grid into new dimensions, preserving the overlapping top-left
 * region and filling any newly exposed cells with `fillValue`. Pure: builds and
 * returns a new array rather than mutating the input.
 *
 * @param grid The source flat grid, `oldWidth * oldHeight` cells.
 * @param oldWidth The source width in cells.
 * @param oldHeight The source height in cells.
 * @param newWidth The target width in cells.
 * @param newHeight The target height in cells.
 * @param fillValue The value newly exposed cells take.
 */
function resizeGrid(
	grid: number[],
	oldWidth: number,
	oldHeight: number,
	newWidth: number,
	newHeight: number,
	fillValue: number,
): number[] {
	let next = new Array<number>(newWidth * newHeight).fill(fillValue);
	let rows = Math.min(oldHeight, newHeight);
	let columns = Math.min(oldWidth, newWidth);
	for (let y = 0; y < rows; y++) {
		for (let x = 0; x < columns; x++) {
			next[y * newWidth + x] = grid[y * oldWidth + x]!;
		}
	}
	return next;
}

/** Returns a deep copy of an event (id/position/name plus every page) so callers
 * cannot mutate the editor's internal state through the snapshot. */
function cloneEvent(event: MapEvent): MapEvent {
	return {
		id: event.id,
		x: event.x,
		y: event.y,
		name: event.name,
		pages: event.pages.map(clonePage),
	};
}
