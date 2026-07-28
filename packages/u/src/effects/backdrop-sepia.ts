/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { backdropFilterFunction } from "../internal/backdrop-filter";

/**
 * Applies a `backdrop-filter: sepia(...)` behind the element, shifting
 * whatever shows through toward a warm brown monochrome. `1` (the default) is
 * a full conversion and `0` leaves it untouched.
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
 * @example u.backdropSepia()
 * @example css({ "--ui-backdrop-sepia": "1", backdropFilter: "... sepia(var(--ui-backdrop-sepia, 0))", WebkitBackdropFilter: "... sepia(var(--ui-backdrop-sepia, 0))" })
 * @example u.transparencySafe(u.backdropSepia(0.6))
 * @example css({ "@media (prefers-reduced-transparency: no-preference)": { "--ui-backdrop-sepia": "0.6", backdropFilter: "...", WebkitBackdropFilter: "..." } })
 */
export function backdropSepia<Node extends Element = Element>(value: number | (string & {}) = 1) {
	return backdropFilterFunction<Node>({ sepia: String(value) });
}
