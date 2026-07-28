/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { backdropFilterFunction } from "../internal/backdrop-filter";

/**
 * Applies a `backdrop-filter: opacity(...)` behind the element, fading what
 * shows through toward whatever is painted further back. Takes CSS's native
 * `0`–`1` range (or a percentage string) — not the `0`–`100` integer
 * convention `u.opacity()` uses, and unlike `u.opacity()` it does not touch
 * the element's own contents at all: only its backdrop.
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
 * @example u.backdropOpacity()
 * @example css({ "--ui-backdrop-opacity": "0.5", backdropFilter: "... opacity(var(--ui-backdrop-opacity, 1)) ...", WebkitBackdropFilter: "... opacity(var(--ui-backdrop-opacity, 1)) ..." })
 * @example u.transparencySafe(u.backdropOpacity("25%"))
 * @example css({ "@media (prefers-reduced-transparency: no-preference)": { "--ui-backdrop-opacity": "25%", backdropFilter: "...", WebkitBackdropFilter: "..." } })
 */
export function backdropOpacity<Node extends Element = Element>(
	value: number | (string & {}) = 0.5,
) {
	return backdropFilterFunction<Node>({ opacity: String(value) });
}
