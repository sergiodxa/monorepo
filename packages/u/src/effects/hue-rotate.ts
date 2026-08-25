/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { AngleValue } from "../internal/transform";

import { filterFunction } from "../internal/filter";
import { angle } from "../internal/transform";

/**
 * Applies a `filter: hue-rotate(...)`, rotating every pixel's hue by the given
 * angle while preserving lightness and saturation, so one source asset can be
 * retinted per theme. A bare number is degrees; strings pass through as-is.
 *
 * @example u.hueRotate()
 * @example css({ "--ui-filter-hue-rotate": "90deg", filter: "... hue-rotate(var(--ui-filter-hue-rotate, 0deg)) ..." })
 * @example u.hueRotate("0.5turn")
 * @example css({ "--ui-filter-hue-rotate": "0.5turn", filter: "... hue-rotate(var(--ui-filter-hue-rotate, 0deg)) ..." })
 */
export function hueRotate<Node extends Element = Element>(value: AngleValue = 90) {
	return filterFunction<Node>({ hueRotate: angle(value) });
}
