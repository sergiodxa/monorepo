/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { backdropFilterFunction } from "../internal/backdrop-filter";

/**
 * Scales the backdrop's lightness — below `1` darkens, above `1` brightens —
 * keeping overlaid text legible. Needs a partly transparent host background;
 * combines with sibling backdrop utilities; `u.transparencySafe()` gates it.
 *
 * @example u.backdropBrightness()
 * @example css({ "--ui-backdrop-brightness": "1.1", backdropFilter: "... brightness(var(--ui-backdrop-brightness, 1)) ...", WebkitBackdropFilter: "... brightness(var(--ui-backdrop-brightness, 1)) ..." })
 * @example u.transparencySafe(u.backdropBrightness(0.8))
 * @example css({ "@media (prefers-reduced-transparency: no-preference)": { "--ui-backdrop-brightness": "0.8", backdropFilter: "...", WebkitBackdropFilter: "..." } })
 */
export function backdropBrightness<Node extends Element = Element>(
	value: number | (string & {}) = 1.1,
) {
	return backdropFilterFunction<Node>({ brightness: String(value) });
}
