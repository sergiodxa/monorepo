/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { backdropFilterFunction } from "../internal/backdrop-filter.js";

/**
 * Desaturates the backdrop toward grey (`1` fully, `0` untouched) so a coloured
 * overlay reads as the only hue in the area. Needs a partly transparent host;
 * combines with sibling utilities; `u.transparencySafe()` gates it.
 *
 * @example u.backdropGrayscale()
 * @example css({ "--ui-backdrop-grayscale": "1", backdropFilter: "... grayscale(var(--ui-backdrop-grayscale, 0)) ...", WebkitBackdropFilter: "... grayscale(var(--ui-backdrop-grayscale, 0)) ..." })
 * @example u.transparencySafe(u.backdropGrayscale(0.5))
 * @example css({ "@media (prefers-reduced-transparency: no-preference)": { "--ui-backdrop-grayscale": "0.5", backdropFilter: "...", WebkitBackdropFilter: "..." } })
 */
export function backdropGrayscale<Node extends Element = Element>(
	value: number | (string & {}) = 1,
) {
	return backdropFilterFunction<Node>({ grayscale: String(value) });
}
