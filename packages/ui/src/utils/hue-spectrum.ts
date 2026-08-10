/**
 * The fixed seven-stop hue spectrum shared by every hue-based gradient this
 * component family paints — a plain string with no rendering logic of its
 * own, reused verbatim wherever a gradient formula needs the complete hue
 * spectrum rather than a single resolved color.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The seven hue stops, `0` through `360` in even sixty-degree steps, that
 * sweep once through the full spectrum — red, yellow, green, cyan, blue,
 * magenta, and back to red — landing exactly where they started. Shared
 * verbatim by every hue gradient this component family paints, whether swept
 * along a straight track or around a ring, so every rendering of the
 * spectrum stays pixel-for-pixel identical.
 *
 * @example
 * `linear-gradient(to right, ${HUE_GRADIENT_STOPS})`;
 * @example
 * `conic-gradient(from 0deg, ${HUE_GRADIENT_STOPS})`;
 */
export const HUE_GRADIENT_STOPS =
	"hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%)";
