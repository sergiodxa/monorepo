/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { AngleValue } from "../internal/transform";

import { backdropFilterFunction } from "../internal/backdrop-filter";
import { angle } from "../internal/transform";

/**
 * Applies a `backdrop-filter: hue-rotate(...)` behind the element, rotating
 * the hue of whatever shows through around the colour wheel while leaving its
 * lightness and saturation alone. Useful for pulling an arbitrary backdrop
 * toward a single brand hue under a translucent panel, since rotation keeps
 * the backdrop's original light/dark structure intact.
 *
 * A bare number is degrees; a string passes through unchanged, for `turn`,
 * `rad`, or a `calc(...)`.
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
 * @example u.backdropHueRotate()
 * @example css({ "--ui-backdrop-hue-rotate": "90deg", backdropFilter: "... hue-rotate(var(--ui-backdrop-hue-rotate, 0deg)) ...", WebkitBackdropFilter: "... hue-rotate(var(--ui-backdrop-hue-rotate, 0deg)) ..." })
 * @example u.transparencySafe(u.backdropHueRotate("0.5turn"))
 * @example css({ "@media (prefers-reduced-transparency: no-preference)": { "--ui-backdrop-hue-rotate": "0.5turn", backdropFilter: "...", WebkitBackdropFilter: "..." } })
 */
export function backdropHueRotate<Node extends Element = Element>(value: AngleValue = 90) {
	return backdropFilterFunction<Node>({ hueRotate: angle(value) });
}
