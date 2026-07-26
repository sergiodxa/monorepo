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
 * Composable with `u.backdropBlur()` — both set the shared composite
 * `backdropFilter` declaration, so applying both to the same element
 * combines saturation and blur instead of the last one overwriting the
 * other.
 *
 * @example u.backdropSaturate(1.4)
 * @example css({ "--ui-backdrop-saturate": "1.4", backdropFilter: "blur(var(--ui-backdrop-blur, 0px)) saturate(var(--ui-backdrop-saturate, 1))", WebkitBackdropFilter: "blur(var(--ui-backdrop-blur, 0px)) saturate(var(--ui-backdrop-saturate, 1))" })
 */
export function backdropSaturate<Node extends Element = Element>(
	value: number | (string & {}) = 1.4,
) {
	return backdropFilterFunction<Node>({ saturate: String(value) });
}
