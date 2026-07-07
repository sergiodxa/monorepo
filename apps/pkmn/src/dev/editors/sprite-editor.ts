/**
 * Canvas-backed sprite pixel editor for the dev tools. A plain class (no framework
 * coupling) that owns ALL editor state: the pure {@link PixelGrid} model, the
 * current tool and color, and the canvas handed to it by the view via
 * {@link SpriteEditor.attach}. The view constructs it once in component setup and
 * wires pointer-free lifecycle through the `ref` mixin; every user gesture flows
 * through this class, which mutates the grid and repaints.
 *
 * Rendering scales the small pixel grid up to fill the display canvas: a
 * checkerboard shows through transparent pixels, painted pixels are drawn on top,
 * and thin grid lines separate cells. The model itself stays canvas-free (see
 * {@link PixelGrid}) so it can be unit-tested without a DOM; this class is the
 * imperative shell around it. {@link SpriteEditor.toPng} rasterizes the grid at
 * native resolution (one canvas pixel per grid pixel, transparency preserved) to
 * an offscreen canvas and returns encoded PNG bytes for the export action.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { PixelGrid, type Rgb } from "./pixel-grid";

/** The two drawing tools: paint the current color, or erase to transparent. */
export type SpriteTool = "pen" | "eraser";

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

/** Default sprite size when the editor is first constructed (a 16×16 tile). */
const DEFAULT_WIDTH = 16;

/** Default sprite height, paired with {@link DEFAULT_WIDTH}. */
const DEFAULT_HEIGHT = 16;

/** Default pen color (opaque black) before the user picks one. */
const DEFAULT_COLOR: Rgb = { r: 0, g: 0, b: 0 };

/** Side length in display pixels of one checkerboard square (in native pixels). */
const CHECKER_SIZE = 8;

/** Fill for the light checkerboard squares seen through transparent pixels. */
const CHECKER_LIGHT = "#3a3a3a";

/** Fill for the dark checkerboard squares seen through transparent pixels. */
const CHECKER_DARK = "#2a2a2a";

/** Stroke color for the per-cell grid lines drawn over the scaled sprite. */
const GRID_LINE = "rgba(255, 255, 255, 0.08)";

/** Target display size in CSS/canvas pixels the grid is scaled to fill. */
const DISPLAY_SIZE = 512;

/**
 * Canvas-backed sprite editor. Wraps a {@link PixelGrid} and mirrors it onto a
 * display canvas, translating pointer input into grid mutations.
 */
export class SpriteEditor {
	/** The pure pixel model this editor edits and renders. */
	#grid: PixelGrid;

	/** Currently selected tool (pen paints, eraser clears). */
	#tool: SpriteTool = "pen";

	/** Currently selected pen color. */
	#color: Rgb = { ...DEFAULT_COLOR };

	/** The display canvas, or `null` before {@link attach} / after {@link detach}. */
	#canvas: HTMLCanvasElement | null = null;

	/** Whether a pointer drag is in progress (paints on move while true). */
	#painting = false;

	/** Bound pointer handlers, kept so {@link detach} can remove the exact refs. */
	#onPointerDown = (event: PointerEvent) => this.#handlePointerDown(event);
	#onPointerMove = (event: PointerEvent) => this.#handlePointerMove(event);
	#onPointerUp = () => this.#stopPainting();

	/**
	 * @param width Initial sprite width in pixels.
	 * @param height Initial sprite height in pixels.
	 */
	constructor(width: number = DEFAULT_WIDTH, height: number = DEFAULT_HEIGHT) {
		this.#grid = new PixelGrid(width, height);
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
	 * Releases the canvas and removes every listener so a detached editor cannot
	 * keep drawing or leak handlers. Called from the view when the canvas unmounts.
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
	 * Sets the active pen color. Does not repaint the grid — existing pixels keep
	 * their colors; only future pen strokes use the new value.
	 *
	 * @param color The RGB color future pen strokes paint.
	 */
	setColor(color: Rgb): void {
		this.#color = { r: color.r, g: color.g, b: color.b };
	}

	/**
	 * Selects the active tool.
	 *
	 * @param tool `"pen"` to paint the current color, `"eraser"` to clear pixels.
	 */
	setTool(tool: SpriteTool): void {
		this.#tool = tool;
	}

	/** Clears the whole grid to transparency and repaints. */
	clear(): void {
		this.#grid.clear();
		this.render();
	}

	/**
	 * Resizes the sprite, preserving the overlapping top-left region, and repaints.
	 *
	 * @param width New width in pixels.
	 * @param height New height in pixels.
	 */
	resize(width: number, height: number): void {
		this.#grid.resize(width, height);
		this.render();
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
	 * transparency preserved) and encodes it as PNG bytes. Uses `OffscreenCanvas`
	 * when available (`convertToBlob`) and falls back to a detached `<canvas>`
	 * (`toBlob`) otherwise, so it works in both worker-like and DOM contexts.
	 *
	 * @returns The PNG-encoded sprite as bytes.
	 */
	async toPng(): Promise<Uint8Array> {
		let width = this.#grid.width;
		let height = this.#grid.height;
		// Build the ImageData from a fresh array backed by a plain ArrayBuffer (the
		// constructor rejects a SharedArrayBuffer-backed view), copying the grid in.
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
	 * Paints (or erases) the grid pixel under a pointer event, then repaints. Maps
	 * the event's canvas-relative position to a grid cell and applies the tool.
	 *
	 * @param event The pointer event whose position selects the target pixel.
	 */
	#paintAt(event: PointerEvent): void {
		if (this.#canvas === null) return;
		let rect = this.#canvas.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return;

		let x = Math.floor(((event.clientX - rect.left) / rect.width) * this.#grid.width);
		let y = Math.floor(((event.clientY - rect.top) / rect.height) * this.#grid.height);
		if (!this.#grid.inBounds(x, y)) return;

		if (this.#tool === "eraser") this.#grid.clearPixel(x, y);
		else this.#grid.set(x, y, this.#color);
		this.render();
	}

	/** Starts a drag and paints the initial pixel. */
	#handlePointerDown(event: PointerEvent): void {
		this.#painting = true;
		this.#canvas?.setPointerCapture(event.pointerId);
		this.#paintAt(event);
	}

	/** Paints along the drag while the pointer is held down. */
	#handlePointerMove(event: PointerEvent): void {
		if (!this.#painting) return;
		this.#paintAt(event);
	}

	/** Ends the current drag. */
	#stopPainting(): void {
		this.#painting = false;
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
