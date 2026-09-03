/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { AngleValue } from "../internal/transform.js";

import { backdropFilterFunction } from "../internal/backdrop-filter.js";
import { angle } from "../internal/transform.js";

/**
 * Rotates the backdrop's hue while preserving lightness and saturation, so a
 * busy backdrop pulls toward one brand hue with its light/dark structure
 * intact. Needs a partly transparent host; `u.transparencySafe()` gates it.
 *
 * @param value A bare number is degrees; a string is used as written, for
 * `turn`, `rad`, or a `calc(...)`.
 * @example u.backdropHueRotate()
 * @example css({ "--ui-backdrop-hue-rotate": "90deg", backdropFilter: "... hue-rotate(var(--ui-backdrop-hue-rotate, 0deg)) ...", WebkitBackdropFilter: "... hue-rotate(var(--ui-backdrop-hue-rotate, 0deg)) ..." })
 * @example u.transparencySafe(u.backdropHueRotate("0.5turn"))
 * @example css({ "@media (prefers-reduced-transparency: no-preference)": { "--ui-backdrop-hue-rotate": "0.5turn", backdropFilter: "...", WebkitBackdropFilter: "..." } })
 */
export function backdropHueRotate<Node extends Element = Element>(value: AngleValue = 90) {
	return backdropFilterFunction<Node>({ hueRotate: angle(value) });
}
