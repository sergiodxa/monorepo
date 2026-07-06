/**
 * Fixed-grid sprite sheets and frame-sequence animations.
 *
 * A `SpriteSheet` wraps one image whose frames are a uniform grid addressed by
 * index (left-to-right, top-to-bottom), drawing a single frame with optional
 * horizontal flip. A `SpriteAnimation` steps through a list of frame indices on
 * the fixed timestep to drive walk cycles and battle effects. Both work in
 * internal pixels; scaling and smoothing are the client's concern.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One image split into a uniform grid of same-size frames. */
export class SpriteSheet {
	/** Frames per row, derived from the image width. */
	private readonly columns: number;

	/**
	 * @param image - The grid image whose frames are all `frameWidth` x `frameHeight`.
	 * @param frameWidth - Frame width in pixels.
	 * @param frameHeight - Frame height in pixels.
	 */
	constructor(
		readonly image: HTMLImageElement,
		readonly frameWidth: number,
		readonly frameHeight: number,
	) {
		this.columns = Math.max(1, Math.floor(image.width / frameWidth));
	}

	/** Draws one frame at `(x, y)`, optionally mirrored horizontally. */
	draw(ctx: CanvasRenderingContext2D, frame: number, x: number, y: number, flipX = false) {
		let sx = (frame % this.columns) * this.frameWidth;
		let sy = Math.floor(frame / this.columns) * this.frameHeight;

		if (!flipX) {
			ctx.drawImage(
				this.image,
				sx,
				sy,
				this.frameWidth,
				this.frameHeight,
				x,
				y,
				this.frameWidth,
				this.frameHeight,
			);
			return;
		}

		ctx.save();
		ctx.translate(x + this.frameWidth, y);
		ctx.scale(-1, 1);
		ctx.drawImage(
			this.image,
			sx,
			sy,
			this.frameWidth,
			this.frameHeight,
			0,
			0,
			this.frameWidth,
			this.frameHeight,
		);
		ctx.restore();
	}
}

/** A looping or one-shot sequence of sprite-sheet frame indices. */
export class SpriteAnimation {
	/** Elapsed time within the current frame, in milliseconds. */
	private elapsed = 0;

	/** Index into `frames` of the current frame. */
	private index = 0;

	/**
	 * @param frames - Frame indices played in order.
	 * @param frameDuration - Milliseconds each frame is shown.
	 * @param loop - Whether the sequence restarts after the last frame.
	 */
	constructor(
		readonly frames: number[],
		readonly frameDuration: number,
		readonly loop = true,
	) {}

	/** Advances the animation by `dt` milliseconds. */
	update(dt: number) {
		if (this.frames.length <= 1) return;
		this.elapsed += dt;
		while (this.elapsed >= this.frameDuration) {
			this.elapsed -= this.frameDuration;
			if (this.index + 1 < this.frames.length) this.index++;
			else if (this.loop) this.index = 0;
		}
	}

	/** Resets to the first frame. */
	reset() {
		this.elapsed = 0;
		this.index = 0;
	}

	/** The sprite-sheet frame index to draw this update. */
	get frame(): number {
		return this.frames[this.index] ?? 0;
	}

	/** True when a non-looping sequence has reached its last frame. */
	get done(): boolean {
		return !this.loop && this.index === this.frames.length - 1;
	}
}
