/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { backdropFilterFunction } from "../internal/backdrop-filter";

/**
 * Applies a `backdrop-filter: grayscale(...)` behind the element,
 * desaturating whatever shows through toward grey. `1` (the default) is fully
 * grey and `0` leaves it untouched — a way to strip colour out of a busy
 * backdrop so a coloured overlay on top of it reads as the only hue in the
 * area.
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
 * @example u.backdropGrayscale()
 * @example css({ "--ui-backdrop-grayscale": "1", backdropFilter: "... grayscale(var(--ui-backdrop-grayscale, 0)) ...", WebkitBackdropFilter: "... grayscale(var(--ui-backdrop-grayscale, 0)) ..." })
 * @example u.transparencySafe(u.backdropGrayscale(0.5))
 * @example css({ "@media (prefers-reduced-transparency: no-preference)": { "--ui-backdrop-grayscale": "0.5", backdropFilter: "...", WebkitBackdropFilter: "..." } })
 */
export function backdropGrayscale<Node extends Element = Element>(
	value: number | (string & {}) = 1,
) {
	return backdropFilterFunction<Node>({ grayscale: String(value) });
}
