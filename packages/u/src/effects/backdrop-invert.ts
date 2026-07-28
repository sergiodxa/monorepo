/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { backdropFilterFunction } from "../internal/backdrop-filter";

/**
 * Applies a `backdrop-filter: invert(...)` behind the element, inverting the
 * colours of whatever shows through. `1` (the default) is a full inversion and
 * `0` leaves it untouched. A heavy, deliberately graphic effect — most often
 * used at a partial amount, or on a small cutout such as a custom cursor or
 * magnifier that should stay visible over any backdrop.
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
 * @example u.backdropInvert()
 * @example css({ "--ui-backdrop-invert": "1", backdropFilter: "... invert(var(--ui-backdrop-invert, 0)) ...", WebkitBackdropFilter: "... invert(var(--ui-backdrop-invert, 0)) ..." })
 * @example u.transparencySafe(u.backdropInvert(0.15))
 * @example css({ "@media (prefers-reduced-transparency: no-preference)": { "--ui-backdrop-invert": "0.15", backdropFilter: "...", WebkitBackdropFilter: "..." } })
 */
export function backdropInvert<Node extends Element = Element>(value: number | (string & {}) = 1) {
	return backdropFilterFunction<Node>({ invert: String(value) });
}
