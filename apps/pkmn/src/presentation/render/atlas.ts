/**
 * An asset-agnostic multi-sprite atlas: one image sliced into named regions.
 *
 * An `Atlas` wraps a single blittable source — a loaded `HTMLImageElement` or a
 * generated `HTMLCanvasElement` — together with a map of `regionName -> Rect` and
 * an optional map of animated regions (`regionName -> { frames; frameMs }`). This
 * lets the renderer address art by meaningful names ("tile.grass", "hero.down.0",
 * "creature.body") instead of raw grid indices, so any pack — hand-authored,
 * generated, or an openly-licensed drop-in — plugs in the same way.
 *
 * The region math (`regionRect`) and the animation frame selection (`frameIndex`,
 * `animationRect`) are pure functions of their inputs so they can be unit-tested
 * without a canvas. `drawSprite` blits a region with nearest-neighbor scaling and
 * an integer scale factor to keep the pixel look crisp; it is a safe no-op when
 * the requested region is missing, so an incomplete atlas never crashes a frame.
 * All coordinates are in internal pixels; the client owns final upscaling.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A rectangular sub-region of an atlas source, in source pixels. */
export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** An animated region: an ordered list of frame rects shown `frameMs` apart. */
export interface AtlasAnimation {
	/** The source rects played in order, one per frame. */
	frames: Rect[];
	/** Milliseconds each frame is shown before advancing. */
	frameMs: number;
	/** Whether the sequence wraps after the last frame (default true). */
	loop?: boolean;
}

/** Anything the atlas can blit from: a decoded image or a generated canvas. */
export type AtlasSource = CanvasImageSource & { width: number; height: number };

/** The minimal drawing surface `drawSprite` needs, so tests can pass a fake. */
export interface DrawContext {
	drawImage(
		image: CanvasImageSource,
		sx: number,
		sy: number,
		sw: number,
		sh: number,
		dx: number,
		dy: number,
		dw: number,
		dh: number,
	): void;
	save(): void;
	restore(): void;
	translate(x: number, y: number): void;
	scale(x: number, y: number): void;
}

/** Per-blit options: integer upscale and horizontal mirroring. */
export interface DrawSpriteOptions {
	/** Integer scale factor applied to the region's size (floored, min 1). */
	scale?: number;
	/** Mirror the region horizontally around its drawn center. */
	flipX?: boolean;
}

/**
 * Returns the source rect for a static region, or `null` when it is unknown.
 *
 * Pure: no canvas or source access, only the region map lookup, so callers can
 * reason about placement and tests can assert the math directly.
 */
export function regionRect(regions: Readonly<Record<string, Rect>>, name: string): Rect | null {
	return regions[name] ?? null;
}

/**
 * Selects which frame of an animation is showing after `elapsedMs`.
 *
 * Pure integer math. A single-frame (or empty) animation always yields index 0.
 * A looping animation wraps with a modulo over its length; a one-shot animation
 * clamps to and holds the last frame once the sequence has fully played.
 */
export function frameIndex(animation: AtlasAnimation, elapsedMs: number): number {
	let count = animation.frames.length;
	if (count <= 1) return 0;
	let step = Math.floor(Math.max(0, elapsedMs) / animation.frameMs);
	if (animation.loop ?? true) return step % count;
	return Math.min(step, count - 1);
}

/**
 * Resolves the source rect an animated region shows after `elapsedMs`.
 *
 * Pure: composes `frameIndex` with the animation's frame list; returns `null`
 * when the animation defines no frames so callers can fall back safely.
 */
export function animationRect(animation: AtlasAnimation, elapsedMs: number): Rect | null {
	if (animation.frames.length === 0) return null;
	return animation.frames[frameIndex(animation, elapsedMs)] ?? null;
}

/** One image (or canvas) plus its named-region and animated-region maps. */
export class Atlas {
	/**
	 * @param source - The blittable image or generated canvas backing the regions.
	 * @param regions - Static region rects keyed by name.
	 * @param animations - Optional animated regions keyed by name.
	 */
	constructor(
		readonly source: AtlasSource,
		readonly regions: Readonly<Record<string, Rect>>,
		readonly animations: Readonly<Record<string, AtlasAnimation>> = {},
	) {}

	/** True when the atlas defines a static region with this name. */
	hasRegion(name: string): boolean {
		return name in this.regions;
	}

	/** True when the atlas defines an animated region with this name. */
	hasAnimation(name: string): boolean {
		return name in this.animations;
	}

	/** The source rect for a static region, or `null` when unknown. */
	rect(name: string): Rect | null {
		return regionRect(this.regions, name);
	}

	/** The source rect an animated region shows after `elapsedMs`, or `null`. */
	animatedRect(name: string, elapsedMs: number): Rect | null {
		let animation = this.animations[name];
		if (!animation) return null;
		return animationRect(animation, elapsedMs);
	}

	/**
	 * Blits a static region at `(dx, dy)`, integer-scaled and optionally mirrored.
	 *
	 * A no-op when the region is unknown, so drawing an atlas that lacks the
	 * requested art never throws — the caller can fall back to procedural drawing.
	 */
	draw(ctx: DrawContext, name: string, dx: number, dy: number, options: DrawSpriteOptions = {}) {
		let rect = this.rect(name);
		if (!rect) return;
		blit(ctx, this.source, rect, dx, dy, options);
	}
}

/**
 * Draws region `name` from `atlas` at `(dx, dy)`, or does nothing when absent.
 *
 * A free-function convenience over `Atlas#draw` so call sites read as
 * `drawSprite(ctx, atlas, "tile.grass", x, y)`; tolerates a `null` atlas so a
 * renderer can attempt an atlas blit and fall through to procedural drawing with
 * a single guardless call.
 */
export function drawSprite(
	ctx: DrawContext,
	atlas: Atlas | null | undefined,
	name: string,
	dx: number,
	dy: number,
	options: DrawSpriteOptions = {},
): boolean {
	if (!atlas) return false;
	let rect = atlas.rect(name);
	if (!rect) return false;
	blit(ctx, atlas.source, rect, dx, dy, options);
	return true;
}

/**
 * Draws the current frame of animated region `name` after `elapsedMs`.
 *
 * Returns whether anything was drawn so a caller can fall back to procedural
 * drawing when the animation (or atlas) is missing.
 */
export function drawAnimatedSprite(
	ctx: DrawContext,
	atlas: Atlas | null | undefined,
	name: string,
	elapsedMs: number,
	dx: number,
	dy: number,
	options: DrawSpriteOptions = {},
): boolean {
	if (!atlas) return false;
	let rect = atlas.animatedRect(name, elapsedMs);
	if (!rect) return false;
	blit(ctx, atlas.source, rect, dx, dy, options);
	return true;
}

/** Blits one source rect with an integer scale and optional horizontal mirror. */
function blit(
	ctx: DrawContext,
	source: AtlasSource,
	rect: Rect,
	dx: number,
	dy: number,
	options: DrawSpriteOptions,
) {
	let scale = Math.max(1, Math.floor(options.scale ?? 1));
	let dw = rect.w * scale;
	let dh = rect.h * scale;
	let x = Math.round(dx);
	let y = Math.round(dy);

	if (!options.flipX) {
		ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h, x, y, dw, dh);
		return;
	}

	ctx.save();
	ctx.translate(x + dw, y);
	ctx.scale(-1, 1);
	ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h, 0, 0, dw, dh);
	ctx.restore();
}
