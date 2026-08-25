/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * One `color-mix()` stop. A numeric `weight` is treated as a percentage and
 * suffixed with `%`; a string `weight`, such as a `calc()` expression, passes
 * through unchanged.
 */
export type ColorMixStop = string | { color: string; weight?: number | string };

function formatStop(stop: ColorMixStop): string {
	if (typeof stop === "string") return stop;
	if (stop.weight === undefined) return stop.color;
	let weight = typeof stop.weight === "number" ? `${stop.weight}%` : stop.weight;
	return `${stop.color} ${weight}`;
}

/**
 * Builds a `color-mix(...)` value string for any color-accepting property.
 * `colorSpace` is the raw interpolation space CSS expects (`"oklab"`,
 * `"srgb"`, `"hsl"`, ...).
 *
 * @example u.colorMix("oklab", { color: "currentcolor", weight: 70 }, "transparent")
 * @example "color-mix(in oklab, currentcolor 70%, transparent)"
 */
export function colorMix(colorSpace: string, ...stops: ColorMixStop[]): string {
	return `color-mix(in ${colorSpace}, ${stops.map(formatStop).join(", ")})`;
}
