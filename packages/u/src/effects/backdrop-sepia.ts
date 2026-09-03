/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { backdropFilterFunction } from "../internal/backdrop-filter.js";

/**
 * Shifts what shows through the element's translucent background toward a warm
 * brown monochrome. Composes with every other backdrop utility; wrap in
 * `u.transparencySafe()` for a solid fallback.
 *
 * @example u.backdropSepia()
 * @example css({ "--ui-backdrop-sepia": "1", backdropFilter: "... sepia(var(--ui-backdrop-sepia, 0))", WebkitBackdropFilter: "... sepia(var(--ui-backdrop-sepia, 0))" })
 * @example u.transparencySafe(u.backdropSepia(0.6))
 * @example css({ "@media (prefers-reduced-transparency: no-preference)": { "--ui-backdrop-sepia": "0.6", backdropFilter: "...", WebkitBackdropFilter: "..." } })
 */
export function backdropSepia<Node extends Element = Element>(value: number | (string & {}) = 1) {
	return backdropFilterFunction<Node>({ sepia: String(value) });
}
