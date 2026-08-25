/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { backdropFilterFunction } from "../internal/backdrop-filter";

/**
 * Pushes the backdrop away from (above `1`) or toward (below `1`) mid-grey;
 * flattening it to a uniform tone keeps overlaid text legible. Needs a partly
 * transparent host; sibling utilities combine; `u.transparencySafe()` gates it.
 *
 * @example u.backdropContrast()
 * @example css({ "--ui-backdrop-contrast": "1.25", backdropFilter: "... contrast(var(--ui-backdrop-contrast, 1)) ...", WebkitBackdropFilter: "... contrast(var(--ui-backdrop-contrast, 1)) ..." })
 * @example u.transparencySafe(u.backdropContrast(0.75))
 * @example css({ "@media (prefers-reduced-transparency: no-preference)": { "--ui-backdrop-contrast": "0.75", backdropFilter: "...", WebkitBackdropFilter: "..." } })
 */
export function backdropContrast<Node extends Element = Element>(
	value: number | (string & {}) = 1.25,
) {
	return backdropFilterFunction<Node>({ contrast: String(value) });
}
