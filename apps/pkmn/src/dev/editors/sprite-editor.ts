/**
 * Placeholder sprite editor for the dev tools. A plain class that owns a canvas
 * element handed to it by the view (`attach`) and draws a checkerboard grid so
 * the class-in-a-component wiring is verifiable end to end. The real drawing
 * surface, palette, and tools arrive in a later phase.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Side length in device pixels of each placeholder grid cell. */
const CELL_SIZE = 16;

/** Grid width in cells; the canvas is sized to fit exactly this many columns. */
const GRID_COLUMNS = 16;

/** Grid height in cells; the canvas is sized to fit exactly this many rows. */
const GRID_ROWS = 16;

/** Fill for the light checkerboard cells. */
const LIGHT_CELL = "#3a3a3a";

/** Fill for the dark checkerboard cells. */
const DARK_CELL = "#2a2a2a";

/**
 * Minimal sprite-editing surface. Holds a canvas reference and renders a
 * placeholder grid; construction is side-effect free so a view can build it in
 * component setup and only touch the DOM once {@link attach} runs on mount.
 */
export class SpriteEditor {
	/** The canvas this editor draws into, or `null` before {@link attach}. */
	#canvas: HTMLCanvasElement | null = null;

	/**
	 * Binds the editor to its canvas element and performs the first render.
	 * Called from the view when the canvas mounts into the DOM.
	 *
	 * @param canvas The mounted canvas element to take ownership of.
	 */
	attach(canvas: HTMLCanvasElement): void {
		this.#canvas = canvas;
		canvas.width = GRID_COLUMNS * CELL_SIZE;
		canvas.height = GRID_ROWS * CELL_SIZE;
		this.render();
	}

	/**
	 * Releases the canvas reference so a detached editor cannot keep drawing.
	 * Called from the view when the canvas is removed from the DOM.
	 */
	detach(): void {
		this.#canvas = null;
	}

	/**
	 * Draws the placeholder checkerboard into the attached canvas. A no-op when
	 * no canvas is attached or a 2D context is unavailable.
	 */
	render(): void {
		if (this.#canvas === null) return;
		let context = this.#canvas.getContext("2d");
		if (context === null) return;

		for (let row = 0; row < GRID_ROWS; row++) {
			for (let column = 0; column < GRID_COLUMNS; column++) {
				context.fillStyle = (row + column) % 2 === 0 ? LIGHT_CELL : DARK_CELL;
				context.fillRect(column * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
			}
		}
	}
}
