/**
 * The overworld camera.
 *
 * Tracks a top-left scroll offset in internal pixels, centered on a target and
 * clamped to the map bounds so the view never scrolls past an edge. Scenes
 * subtract the offset for world-space sprites and tiles; screen-space UI ignores it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../core/loop";

/** A clamped scrolling viewport over the overworld. */
export class Camera {
	/** Left edge of the view in world pixels. */
	x = 0;

	/** Top edge of the view in world pixels. */
	y = 0;

	/** Centers the view on a world point, clamped to a map of the given pixel size. */
	centerOn(targetX: number, targetY: number, mapWidthPx: number, mapHeightPx: number) {
		this.x = clamp(targetX - SCREEN_WIDTH / 2, 0, Math.max(0, mapWidthPx - SCREEN_WIDTH));
		this.y = clamp(targetY - SCREEN_HEIGHT / 2, 0, Math.max(0, mapHeightPx - SCREEN_HEIGHT));
	}
}

/** Clamps `value` into the inclusive `[min, max]` range. */
function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
