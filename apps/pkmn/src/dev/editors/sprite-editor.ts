/**
 * Canvas-backed sprite pixel editor for the dev tools. It owns all editor state
 * — the pure {@link PixelGrid} model, the tool and color, the undo/redo history,
 * the recent-color palette — and is the imperative shell that mirrors the grid
 * onto a display canvas. The pure helpers it builds on are exported alongside it
 * so they stay unit-testable on their own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { type GridSnapshot, MAX_DIMENSION, PixelGrid, type Rgb } from "./pixel-grid";

/**
 * The drawing tools. `pen` paints the current color, `eraser` clears to
 * transparent, `fill` flood-fills the contiguous same-color region under the
 * cursor, and `eyedropper` adopts the color under the cursor as the pen color.
 */
export type SpriteTool = "pen" | "eraser" | "fill" | "eyedropper";

/** A named sprite dimension the size selector offers, plus a custom escape hatch. */
export interface SizePreset {
	/** Stable id used as the `<option>` value and to look the preset up. */
	id: string;
	/** Human-readable label shown in the selector. */
	label: string;
	/** Sprite width in pixels. */
	width: number;
	/** Sprite height in pixels. */
	height: number;
}

/**
 * Sprite dimensions the size selector offers. Limited to the small power-of-two
 * tile/character sizes the game actually uses; a separate custom option (handled
 * in the view) allows arbitrary sizes capped at {@link PixelGrid}'s maximum.
 */
export const SIZE_PRESETS: SizePreset[] = [
	{ id: "8x8", label: "8×8", width: 8, height: 8 },
	{ id: "16x16", label: "16×16 (tile)", width: 16, height: 16 },
	{ id: "16x32", label: "16×32 (character)", width: 16, height: 32 },
	{ id: "32x32", label: "32×32", width: 32, height: 32 },
	{ id: "64x64", label: "64×64", width: 64, height: 64 },
];

const DEFAULT_WIDTH = 16;

const DEFAULT_HEIGHT = 16;

const DEFAULT_COLOR: Rgb = { r: 0, g: 0, b: 0 };

/** Side length in native canvas pixels of one checkerboard square. */
const CHECKER_SIZE = 8;

const CHECKER_LIGHT = "#3a3a3a";

const CHECKER_DARK = "#2a2a2a";

/** Stroke color for the per-cell grid lines drawn over the scaled sprite. */
const GRID_LINE = "rgba(255, 255, 255, 0.08)";

/** Target display size in CSS/canvas pixels the grid is scaled to fill. */
const DISPLAY_SIZE = 512;

/** Default depth of the undo/redo history, counted in whole grid states. */
export const DEFAULT_HISTORY_LIMIT = 64;

/** Default number of distinct recent colors the palette tracks. */
export const DEFAULT_RECENT_LIMIT = 8;

/**
 * A bounded undo/redo history of whole {@link GridSnapshot} states, so a step
 * restores the size along with the pixels across intervening resizes. Pushing
 * after an undo forks the timeline, and the oldest states drop past the limit.
 */
export class GridHistory {
	/** Snapshots in chronological order; index 0 is the oldest kept state. */
	#states: GridSnapshot[] = [];

	/** Cursor: index of the current state within {@link #states}, or `-1` when empty. */
	#cursor = -1;

	/** Maximum number of states retained before the oldest are dropped. */
	readonly #limit: number;

	/**
	 * @param limit Maximum number of states to retain (must be a positive
	 *   integer); defaults to {@link DEFAULT_HISTORY_LIMIT}.
	 */
	constructor(limit: number = DEFAULT_HISTORY_LIMIT) {
		if (!Number.isInteger(limit) || limit < 1) {
			throw new RangeError(`Invalid history limit: ${limit} (must be a positive integer).`);
		}
		this.#limit = limit;
	}

	/** Number of states currently retained. */
	get length(): number {
		return this.#states.length;
	}

	/** Whether an {@link undo} would move to an earlier state. */
	get canUndo(): boolean {
		return this.#cursor > 0;
	}

	/** Whether a {@link redo} would move to a later state. */
	get canRedo(): boolean {
		return this.#cursor >= 0 && this.#cursor < this.#states.length - 1;
	}

	/**
	 * Records a new state as the current one. Any redo tail past the cursor is
	 * discarded (a new edit forks the timeline), and the oldest state is dropped
	 * when the limit is exceeded so the cursor always points at the pushed state.
	 *
	 * @param snapshot The state to append and make current.
	 */
	push(snapshot: GridSnapshot): void {
		if (this.#cursor < this.#states.length - 1) {
			this.#states = this.#states.slice(0, this.#cursor + 1);
		}
		this.#states.push(snapshot);
		if (this.#states.length > this.#limit) this.#states.shift();
		this.#cursor = this.#states.length - 1;
	}

	/**
	 * Moves the cursor one step back and returns that earlier state, or `null`
	 * when already at the oldest state.
	 *
	 * @returns The state to restore, or `null` when there is nothing to undo.
	 */
	undo(): GridSnapshot | null {
		if (!this.canUndo) return null;
		this.#cursor--;
		return this.#states[this.#cursor] ?? null;
	}

	/**
	 * Moves the cursor one step forward and returns that later state, or `null`
	 * when already at the newest state.
	 *
	 * @returns The state to restore, or `null` when there is nothing to redo.
	 */
	redo(): GridSnapshot | null {
		if (!this.canRedo) return null;
		this.#cursor++;
		return this.#states[this.#cursor] ?? null;
	}
}

/**
 * Returns a fresh list with `color` at the front, de-duped by exact RGB and
 * capped at `limit` by dropping the oldest. The input list is left as it was,
 * so the caller adopts the returned list as its new palette.
 *
 * @param recent The current recent-color list, most-recent first.
 * @param color The color just used, to promote to the front.
 * @param limit Maximum number of distinct colors to retain.
 * @returns The updated recent-color list, most-recent first.
 */
export function pushRecentColor(
	recent: readonly Rgb[],
	color: Rgb,
	limit: number = DEFAULT_RECENT_LIMIT,
): Rgb[] {
	let normalized: Rgb = {
		r: clampByte(color.r),
		g: clampByte(color.g),
		b: clampByte(color.b),
	};
	let rest = recent.filter(
		(entry) => entry.r !== normalized.r || entry.g !== normalized.g || entry.b !== normalized.b,
	);
	return [normalized, ...rest].slice(0, Math.max(1, Math.trunc(limit)));
}

/** Clamps and rounds a number into a `0..=255` byte for recent-color storage. */
function clampByte(value: number): number {
	if (!Number.isFinite(value)) return 0;
	if (value < 0) return 0;
	if (value > 255) return 255;
	return Math.round(value);
}

/** The pixel payload of a decoded image: dimensions plus a row-major RGBA buffer. */
export interface DecodedImage {
	/** Image width in pixels. */
	width: number;
	/** Image height in pixels. */
	height: number;
	/** Row-major RGBA buffer, four bytes per pixel, length `width * height * 4`. */
	data: Uint8ClampedArray;
}

/**
 * Loads a decoded image into a fresh {@link PixelGrid}, adopting its dimensions
 * and pixels. The pure half of PNG import, so the buffer→grid mapping stays
 * testable; {@link PixelGrid.loadPixels} enforces {@link MAX_DIMENSION} and length.
 *
 * @param image The decoded image to import.
 * @returns A new grid sized to and holding the image's pixels.
 */
export function imageDataToGrid(image: DecodedImage): PixelGrid {
	let grid = new PixelGrid(image.width, image.height);
	grid.loadPixels(image.width, image.height, image.data);
	return grid;
}

/**
 * Canvas-backed sprite editor. Wraps a {@link PixelGrid} and mirrors it onto a
 * display canvas, translating pointer input into grid mutations, with undo/redo,
 * a fill bucket, an eyedropper, a recent-color palette, and PNG import.
 */
export class SpriteEditor {
	/** The pure pixel model this editor edits and renders. */
	#grid: PixelGrid;

	/** Currently selected tool. */
	#tool: SpriteTool = "pen";

	/** Currently selected pen color. */
	#color: Rgb = { ...DEFAULT_COLOR };

	/** The display canvas, or `null` before {@link attach} / after {@link detach}. */
	#canvas: HTMLCanvasElement | null = null;

	/** Whether a pointer drag is in progress (paints on move while true). */
	#painting = false;

	/** Bounded undo/redo history of full grid snapshots. */
	#history: GridHistory;

	/** Recent distinct colors, most-recent first, capped by {@link #recentLimit}. */
	#recent: Rgb[] = [];

	/** Cap on the number of recent colors retained. */
	readonly #recentLimit: number;

	/** Notified after any change to undo/redo availability or the recent palette. */
	#onStateChange: (() => void) | null = null;

	/** Notified when the eyedropper picks a color, so the view can sync its input. */
	#onColorPicked: ((color: Rgb) => void) | null = null;

	/** Bound pointer handlers, kept so {@link detach} can remove the exact refs. */
	#onPointerDown = (event: PointerEvent) => this.#handlePointerDown(event);
	#onPointerMove = (event: PointerEvent) => this.#handlePointerMove(event);
	#onPointerUp = () => this.#stopPainting();

	/**
	 * Seeds the history with the initial blank state so the first edit already
	 * has a state to undo back to.
	 *
	 * @param width Initial sprite width in pixels.
	 * @param height Initial sprite height in pixels.
	 * @param historyLimit Depth of the undo/redo history.
	 * @param recentLimit Number of distinct recent colors to track.
	 */
	constructor(
		width: number = DEFAULT_WIDTH,
		height: number = DEFAULT_HEIGHT,
		historyLimit: number = DEFAULT_HISTORY_LIMIT,
		recentLimit: number = DEFAULT_RECENT_LIMIT,
	) {
		this.#grid = new PixelGrid(width, height);
		this.#history = new GridHistory(historyLimit);
		this.#recentLimit = recentLimit;
		this.#history.push(this.#grid.snapshot());
	}

	/** Current sprite width in pixels. */
	get width(): number {
		return this.#grid.width;
	}

	/** Current sprite height in pixels. */
	get height(): number {
		return this.#grid.height;
	}

	/** The active tool. */
	get tool(): SpriteTool {
		return this.#tool;
	}

	/** The active pen color. */
	get color(): Rgb {
		return { ...this.#color };
	}

	/** Whether an {@link undo} is currently possible. */
	get canUndo(): boolean {
		return this.#history.canUndo;
	}

	/** Whether a {@link redo} is currently possible. */
	get canRedo(): boolean {
		return this.#history.canRedo;
	}

	/** The recent distinct colors, most-recent first (a copy). */
	get recentColors(): Rgb[] {
		return this.#recent.map((color) => ({ ...color }));
	}

	/**
	 * Registers a callback fired after any change to undo/redo availability or the
	 * recent-color palette, so the view can re-render its buttons and swatches.
	 *
	 * @param listener The callback, or `null` to clear it.
	 */
	onStateChange(listener: (() => void) | null): void {
		this.#onStateChange = listener;
	}

	/**
	 * Registers a callback fired when the eyedropper picks a color, so the view
	 * can sync its color input to match.
	 *
	 * @param listener The callback receiving the picked color, or `null`.
	 */
	onColorPicked(listener: ((color: Rgb) => void) | null): void {
		this.#onColorPicked = listener;
	}

	/**
	 * Binds the editor to a display canvas, sizes it, wires pointer listeners, and
	 * performs the first render. Called from the view when the canvas mounts.
	 *
	 * @param canvas The mounted canvas element to take ownership of.
	 */
	attach(canvas: HTMLCanvasElement): void {
		this.#canvas = canvas;
		canvas.width = DISPLAY_SIZE;
		canvas.height = DISPLAY_SIZE;
		canvas.style.touchAction = "none";
		canvas.addEventListener("pointerdown", this.#onPointerDown);
		canvas.addEventListener("pointermove", this.#onPointerMove);
		window.addEventListener("pointerup", this.#onPointerUp);
		this.render();
	}

	/**
	 * Releases the canvas and removes every listener, leaving the editor inert
	 * until the next {@link attach}. Called when the canvas unmounts.
	 */
	detach(): void {
		let canvas = this.#canvas;
		if (canvas !== null) {
			canvas.removeEventListener("pointerdown", this.#onPointerDown);
			canvas.removeEventListener("pointermove", this.#onPointerMove);
		}
		window.removeEventListener("pointerup", this.#onPointerUp);
		this.#painting = false;
		this.#canvas = null;
	}

	/**
	 * Sets the active pen color. Painted pixels keep the colors they already
	 * have; the new value applies from the next pen stroke on.
	 *
	 * @param color The RGB color future pen strokes paint.
	 */
	setColor(color: Rgb): void {
		this.#color = { r: color.r, g: color.g, b: color.b };
	}

	/**
	 * Selects the active tool.
	 *
	 * @param tool The tool future gestures apply (see {@link SpriteTool}).
	 */
	setTool(tool: SpriteTool): void {
		this.#tool = tool;
	}

	/** Clears the whole grid to transparency, records the state, and repaints. */
	clear(): void {
		this.#grid.clear();
		this.#commit();
	}

	/**
	 * Resizes the sprite, preserving the overlapping top-left region, records the
	 * state, and repaints.
	 *
	 * @param width New width in pixels.
	 * @param height New height in pixels.
	 */
	resize(width: number, height: number): void {
		this.#grid.resize(width, height);
		this.#commit();
	}

	/**
	 * Restores the previous state from the undo history and repaints. A no-op when
	 * there is nothing to undo.
	 *
	 * @returns `true` when a state was restored.
	 */
	undo(): boolean {
		let snapshot = this.#history.undo();
		if (snapshot === null) return false;
		this.#grid.restore(snapshot);
		this.render();
		this.#notify();
		return true;
	}

	/**
	 * Re-applies the next state from the redo history and repaints. A no-op when
	 * there is nothing to redo.
	 *
	 * @returns `true` when a state was restored.
	 */
	redo(): boolean {
		let snapshot = this.#history.redo();
		if (snapshot === null) return false;
		this.#grid.restore(snapshot);
		this.render();
		this.#notify();
		return true;
	}

	/**
	 * Decodes an image file/blob and loads its pixels into the grid, resizing it
	 * to match so an existing sprite can be edited. Decoding goes through
	 * `createImageBitmap`; the imported state lands on the undo history.
	 *
	 * @param file The image file or blob to import.
	 * @throws When the image cannot be decoded, a 2D context is unavailable, or
	 *   its dimensions exceed {@link MAX_DIMENSION}.
	 */
	async importImage(file: Blob): Promise<void> {
		let bitmap = await createImageBitmap(file);
		try {
			if (bitmap.width > MAX_DIMENSION || bitmap.height > MAX_DIMENSION) {
				throw new RangeError(
					`Image is ${bitmap.width}×${bitmap.height}; the editor caps sprites at ${MAX_DIMENSION}×${MAX_DIMENSION}.`,
				);
			}
			let decoded = decodeBitmap(bitmap);
			this.#grid.loadPixels(decoded.width, decoded.height, decoded.data);
			this.#commit();
		} finally {
			bitmap.close();
		}
	}

	/**
	 * Renders the grid scaled up to fill the display canvas: a checkerboard behind
	 * transparent pixels, the painted pixels on top, then per-cell grid lines. A
	 * no-op when no canvas is attached or a 2D context is unavailable.
	 */
	render(): void {
		if (this.#canvas === null) return;
		let context = this.#canvas.getContext("2d");
		if (context === null) return;

		let { width, height } = this.#canvas;
		let cellWidth = width / this.#grid.width;
		let cellHeight = height / this.#grid.height;

		this.#drawCheckerboard(context, width, height);

		for (let y = 0; y < this.#grid.height; y++) {
			for (let x = 0; x < this.#grid.width; x++) {
				let pixel = this.#grid.get(x, y);
				if (pixel.a === 0) continue;
				context.fillStyle = `rgb(${pixel.r}, ${pixel.g}, ${pixel.b})`;
				context.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
			}
		}

		this.#drawGridLines(context, cellWidth, cellHeight, width, height);
	}

	/**
	 * Rasterizes the grid at native resolution (one canvas pixel per grid pixel,
	 * transparency preserved) and encodes PNG bytes, preferring `OffscreenCanvas`
	 * so it works in worker-like contexts too.
	 *
	 * @returns The PNG-encoded sprite as bytes.
	 */
	async toPng(): Promise<Uint8Array> {
		let width = this.#grid.width;
		let height = this.#grid.height;
		let pixels = new Uint8ClampedArray(width * height * 4);
		pixels.set(this.#grid.serialize());
		let image = new ImageData(pixels, width, height);

		let blob: Blob;
		if (typeof OffscreenCanvas !== "undefined") {
			let offscreen = new OffscreenCanvas(width, height);
			let context = offscreen.getContext("2d");
			if (context === null)
				throw new Error("Could not acquire an offscreen 2D context for PNG export.");
			context.putImageData(image, 0, 0);
			blob = await offscreen.convertToBlob({ type: "image/png" });
		} else {
			let canvas = document.createElement("canvas");
			canvas.width = width;
			canvas.height = height;
			let context = canvas.getContext("2d");
			if (context === null) throw new Error("Could not acquire a 2D context for PNG export.");
			context.putImageData(image, 0, 0);
			blob = await new Promise<Blob>((resolve, reject) => {
				canvas.toBlob((result) => {
					if (result === null) reject(new Error("Canvas failed to encode a PNG blob."));
					else resolve(result);
				}, "image/png");
			});
		}

		return new Uint8Array(await blob.arrayBuffer());
	}

	/**
	 * Records the current grid state on the undo history, repaints, and notifies
	 * listeners. Called after every mutating operation so undo/redo and the button
	 * states stay in sync.
	 */
	#commit(): void {
		this.#history.push(this.#grid.snapshot());
		this.render();
		this.#notify();
	}

	/** Fires the state-change listener (undo/redo/palette), if one is registered. */
	#notify(): void {
		this.#onStateChange?.();
	}

	/**
	 * Promotes the current pen color to the front of the recent-color palette
	 * (de-duped and capped), then notifies listeners. Called when a pen or fill
	 * gesture actually paints with the color.
	 */
	#recordRecentColor(): void {
		this.#recent = pushRecentColor(this.#recent, this.#color, this.#recentLimit);
	}

	/**
	 * Maps a pointer event's canvas-relative position to a grid cell, or `null`
	 * when it falls outside the grid or the canvas has no size yet.
	 *
	 * @param event The pointer event to locate.
	 * @returns The `{ x, y }` grid cell, or `null` when off-grid.
	 */
	#cellAt(event: PointerEvent): { x: number; y: number } | null {
		if (this.#canvas === null) return null;
		let rect = this.#canvas.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return null;
		let x = Math.floor(((event.clientX - rect.left) / rect.width) * this.#grid.width);
		let y = Math.floor(((event.clientY - rect.top) / rect.height) * this.#grid.height);
		if (!this.#grid.inBounds(x, y)) return null;
		return { x, y };
	}

	/**
	 * Applies the pen or eraser to the grid cell under a drag event and repaints.
	 * History is recorded once on release, so a whole drag undoes as one step. A
	 * no-op for the fill and eyedropper tools or when the event is off-grid.
	 *
	 * @param event The pointer event whose position selects the target pixel.
	 */
	#strokeAt(event: PointerEvent): void {
		let cell = this.#cellAt(event);
		if (cell === null) return;
		if (this.#tool === "eraser") this.#grid.clearPixel(cell.x, cell.y);
		else {
			this.#grid.set(cell.x, cell.y, this.#color);
			this.#recordRecentColor();
		}
		this.render();
	}

	/**
	 * Starts a gesture. Pen and eraser begin a drag stroke; fill and eyedropper
	 * apply once, immediately.
	 *
	 * @param event The pointer event that began the gesture.
	 */
	#handlePointerDown(event: PointerEvent): void {
		if (this.#tool === "eyedropper") {
			this.#pickAt(event);
			return;
		}
		if (this.#tool === "fill") {
			this.#fillAt(event);
			return;
		}
		this.#painting = true;
		this.#canvas?.setPointerCapture(event.pointerId);
		this.#strokeAt(event);
	}

	/** Paints along the drag while the pointer is held down (pen/eraser only). */
	#handlePointerMove(event: PointerEvent): void {
		if (!this.#painting) return;
		this.#strokeAt(event);
	}

	/** Ends the current drag and records the resulting state on the history. */
	#stopPainting(): void {
		if (!this.#painting) return;
		this.#painting = false;
		this.#commit();
	}

	/**
	 * Flood-fills the contiguous same-color region under a pointer event with the
	 * current color, then records the state. A no-op when off-grid or nothing was
	 * filled (seed already the fill color).
	 *
	 * @param event The pointer event whose position seeds the fill.
	 */
	#fillAt(event: PointerEvent): void {
		let cell = this.#cellAt(event);
		if (cell === null) return;
		let filled = this.#grid.floodFill(cell.x, cell.y, this.#color);
		if (filled === 0) {
			this.render();
			return;
		}
		this.#recordRecentColor();
		this.#commit();
	}

	/**
	 * Picks the color under a pointer event into the current pen color and
	 * notifies the color listener so the view's input can follow. Transparent
	 * pixels are skipped, and the grid — with it the history — stays as it is.
	 *
	 * @param event The pointer event whose pixel color is picked.
	 */
	#pickAt(event: PointerEvent): void {
		let cell = this.#cellAt(event);
		if (cell === null) return;
		let pixel = this.#grid.get(cell.x, cell.y);
		if (pixel.a === 0) return;
		let color: Rgb = { r: pixel.r, g: pixel.g, b: pixel.b };
		this.#color = color;
		this.#onColorPicked?.({ ...color });
	}

	/**
	 * Fills the whole canvas with the transparency checkerboard.
	 *
	 * @param context The 2D context to draw into.
	 * @param width Canvas width in pixels.
	 * @param height Canvas height in pixels.
	 */
	#drawCheckerboard(context: CanvasRenderingContext2D, width: number, height: number): void {
		for (let y = 0; y < height; y += CHECKER_SIZE) {
			for (let x = 0; x < width; x += CHECKER_SIZE) {
				let light = (x / CHECKER_SIZE + y / CHECKER_SIZE) % 2 === 0;
				context.fillStyle = light ? CHECKER_LIGHT : CHECKER_DARK;
				context.fillRect(x, y, CHECKER_SIZE, CHECKER_SIZE);
			}
		}
	}

	/**
	 * Strokes thin lines along every cell boundary so individual pixels read as
	 * distinct cells at the scaled-up display size.
	 *
	 * @param context The 2D context to draw into.
	 * @param cellWidth Display width of one grid cell.
	 * @param cellHeight Display height of one grid cell.
	 * @param width Canvas width in pixels.
	 * @param height Canvas height in pixels.
	 */
	#drawGridLines(
		context: CanvasRenderingContext2D,
		cellWidth: number,
		cellHeight: number,
		width: number,
		height: number,
	): void {
		context.strokeStyle = GRID_LINE;
		context.lineWidth = 1;
		context.beginPath();
		for (let x = 0; x <= this.#grid.width; x++) {
			let px = Math.round(x * cellWidth) + 0.5;
			context.moveTo(px, 0);
			context.lineTo(px, height);
		}
		for (let y = 0; y <= this.#grid.height; y++) {
			let py = Math.round(y * cellHeight) + 0.5;
			context.moveTo(0, py);
			context.lineTo(width, py);
		}
		context.stroke();
	}
}

/**
 * Draws an image bitmap onto a native-resolution canvas and reads back its RGBA
 * pixels. The DOM half of PNG import (paired with the pure {@link imageDataToGrid});
 * kept a free function so the editor's `importImage` stays readable.
 *
 * @param bitmap The decoded image bitmap to read pixels from.
 * @returns The decoded RGBA pixels plus dimensions.
 * @throws When a 2D context cannot be acquired.
 */
function decodeBitmap(bitmap: ImageBitmap): DecodedImage {
	let width = bitmap.width;
	let height = bitmap.height;
	let context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
	if (typeof OffscreenCanvas !== "undefined") {
		let offscreen = new OffscreenCanvas(width, height);
		context = offscreen.getContext("2d");
	} else {
		let canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		context = canvas.getContext("2d");
	}
	if (context === null) throw new Error("Could not acquire a 2D context to decode the image.");
	context.drawImage(bitmap, 0, 0);
	let imageData = context.getImageData(0, 0, width, height);
	return { width, height, data: new Uint8ClampedArray(imageData.data) };
}
