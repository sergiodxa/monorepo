/**
 * A plain 2D point, shared by every module under `utils/` that works in
 * pixel or normalized coordinates — an already-scaled SVG plotting position,
 * a pointer position, a normalized `[0, 1]` coordinate, or a circle's
 * center, depending on which function it's passed to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A single 2D position. */
export interface Point {
	x: number;
	y: number;
}
