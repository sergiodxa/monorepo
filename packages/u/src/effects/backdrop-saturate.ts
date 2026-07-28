/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { backdropFilterFunction } from "../internal/backdrop-filter";

/**
 * Applies a `backdrop-filter: saturate(...)` behind the element, boosting
 * (or muting) the saturation of whatever shows through. This is a bare
 * primitive with no accessibility gating, same as `u.backdropBlur()`.
 *
 * Composable with every other backdrop utility — they all set the shared
 * composite `backdropFilter` declaration, so applying `u.backdropBlur()` or
 * `u.backdropContrast()` alongside this one combines every function instead
 * of the last one overwriting the rest.
 *
 * @example u.backdropSaturate(1.4)
 * @example css({ "--ui-backdrop-saturate": "1.4", backdropFilter: "... saturate(var(--ui-backdrop-saturate, 1)) ...", WebkitBackdropFilter: "... saturate(var(--ui-backdrop-saturate, 1)) ..." })
 */
export function backdropSaturate<Node extends Element = Element>(
	value: number | (string & {}) = 1.4,
) {
	return backdropFilterFunction<Node>({ saturate: String(value) });
}
