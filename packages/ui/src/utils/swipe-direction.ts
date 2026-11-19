/**
 * Reads a pointer's travel between `pointerdown` and `pointerup` as a swipe or a tap, so one
 * surface can take both: a carousel advancing on a swipe, a reader paging on one, while a tap
 * still clicks through.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Pixels a pointer travels before a press counts as a swipe; shorter travel is a tap. */
export const SWIPE_DISTANCE = 48;

/** Where a swipe went, along its main axis. */
export type SwipeDirection = "up" | "down" | "left" | "right";

/**
 * The direction of a swipe, taken from whichever axis travelled further; a tie reads as
 * vertical.
 *
 * @param dx - Horizontal travel in pixels, positive to the right.
 * @param dy - Vertical travel in pixels, positive downward.
 * @param threshold - Travel below which the press is a tap.
 * @returns The swipe's direction, or `null` for a tap.
 * @example swipeDirection(event.clientX - start.x, event.clientY - start.y); // "down"
 */
export function swipeDirection(
	dx: number,
	dy: number,
	threshold: number = SWIPE_DISTANCE,
): SwipeDirection | null {
	if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return null;
	if (Math.abs(dy) >= Math.abs(dx)) return dy > 0 ? "down" : "up";
	return dx > 0 ? "right" : "left";
}
