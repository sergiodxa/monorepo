/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { backdropFilterFunction } from "../internal/backdrop-filter";

/**
 * Boosts or mutes the saturation of what shows through the element's
 * translucent background. Composes with every other backdrop utility; wrap in
 * `u.transparencySafe()` for a solid fallback.
 *
 * @example u.backdropSaturate(1.4)
 * @example css({ "--ui-backdrop-saturate": "1.4", backdropFilter: "... saturate(var(--ui-backdrop-saturate, 1)) ...", WebkitBackdropFilter: "... saturate(var(--ui-backdrop-saturate, 1)) ..." })
 */
export function backdropSaturate<Node extends Element = Element>(
	value: number | (string & {}) = 1.4,
) {
	return backdropFilterFunction<Node>({ saturate: String(value) });
}
