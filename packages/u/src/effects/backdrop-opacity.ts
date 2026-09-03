/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { backdropFilterFunction } from "../internal/backdrop-filter.js";

/**
 * Fades what shows through the element's translucent background, taking CSS's
 * native `0`–`1` range or a percentage string. Composes with every other
 * backdrop utility; wrap in `u.transparencySafe()` for a solid fallback.
 *
 * @example u.backdropOpacity()
 * @example css({ "--ui-backdrop-opacity": "0.5", backdropFilter: "... opacity(var(--ui-backdrop-opacity, 1)) ...", WebkitBackdropFilter: "... opacity(var(--ui-backdrop-opacity, 1)) ..." })
 * @example u.transparencySafe(u.backdropOpacity("25%"))
 * @example css({ "@media (prefers-reduced-transparency: no-preference)": { "--ui-backdrop-opacity": "25%", backdropFilter: "...", WebkitBackdropFilter: "..." } })
 */
export function backdropOpacity<Node extends Element = Element>(
	value: number | (string & {}) = 0.5,
) {
	return backdropFilterFunction<Node>({ opacity: String(value) });
}
