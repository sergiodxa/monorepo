/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { backdropFilterFunction } from "../internal/backdrop-filter.js";

/**
 * Inverts the colours showing through the element's translucent background.
 * Composes with every other backdrop utility through the shared composite
 * `backdropFilter`; wrap in `u.transparencySafe()` for a solid fallback.
 *
 * @example u.backdropInvert()
 * @example css({ "--ui-backdrop-invert": "1", backdropFilter: "... invert(var(--ui-backdrop-invert, 0)) ...", WebkitBackdropFilter: "... invert(var(--ui-backdrop-invert, 0)) ..." })
 * @example u.transparencySafe(u.backdropInvert(0.15))
 * @example css({ "@media (prefers-reduced-transparency: no-preference)": { "--ui-backdrop-invert": "0.15", backdropFilter: "...", WebkitBackdropFilter: "..." } })
 */
export function backdropInvert<Node extends Element = Element>(value: number | (string & {}) = 1) {
	return backdropFilterFunction<Node>({ invert: String(value) });
}
