/**
 * The fixed seven-stop hue spectrum shared by every hue-based gradient this
 * component family paints, reused verbatim wherever a gradient formula needs
 * the complete hue spectrum as its color stops.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The seven hue stops, `0` through `360` in even sixty-degree steps, sweep
 * through the full spectrum and land back on red so every hue gradient this
 * component family paints stays pixel-for-pixel identical.
 *
 * @example
 * `linear-gradient(to right, ${HUE_GRADIENT_STOPS})`;
 * @example
 * `conic-gradient(from 0deg, ${HUE_GRADIENT_STOPS})`;
 */
export const HUE_GRADIENT_STOPS =
	"hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%)";
