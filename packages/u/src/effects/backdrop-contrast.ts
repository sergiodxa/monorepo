/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { backdropFilterFunction } from "../internal/backdrop-filter";

/**
 * Applies a `backdrop-filter: contrast(...)` behind the element, pushing what
 * shows through away from (above `1`) or toward (below `1`) mid-grey. Pulling
 * contrast *down* is the useful direction for an overlay: it flattens a
 * detailed backdrop into something closer to a uniform tone, which is what
 * makes text on top of it legible.
 *
 * Two things to keep in mind, both shared by every backdrop utility here:
 *
 * - It has no visible effect unless the element's own background is at least
 *   partly transparent. With an opaque background there is nothing to see
 *   through, so the filtered backdrop is painted over.
 * - It is a bare primitive with no accessibility gating: it applies even when
 *   the user has asked for reduced transparency. A call site that cares should
 *   wrap it in `u.transparencySafe()` and supply a solid fallback.
 *
 * Composes through the shared composite `backdropFilter` declaration (mirrored
 * onto `WebkitBackdropFilter`), so it combines with every other backdrop
 * utility instead of overwriting them.
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
