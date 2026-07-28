/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { backdropFilterFunction } from "../internal/backdrop-filter";

/**
 * Applies a `backdrop-filter: brightness(...)` behind the element, scaling the
 * lightness of whatever shows through — darkening a busy backdrop so overlaid
 * text stays readable, or lifting a dark one. Values below `1` darken, above
 * `1` brighten.
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
