/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { AngleValue } from "../internal/transform";

import { filterFunction } from "../internal/filter";
import { angle } from "../internal/transform";

/**
 * Applies a `filter: hue-rotate(...)`, rotating every pixel's hue around the
 * colour wheel by the given angle while leaving lightness and saturation
 * alone. The real use is recolouring a whole image or icon in one
 * declaration — tinting a single source asset per theme, or shifting a
 * decorative illustration to match a brand hue — without shipping a second
 * copy of the file.
 *
 * Because it rotates rather than negates, `u.hueRotate(180)` lands on the
 * opposite hue but keeps the original lightness, so a light image stays
 * light. That is the difference from `u.invert()`, which flips lightness too
 * and turns a light image dark.
 *
 * A bare number is degrees; a string passes through unchanged, for `turn`,
 * `rad`, or a `calc(...)`. Composes through the shared composite `filter`
 * declaration, so it combines with every other filter utility instead of
 * overwriting them.
 *
 * @example u.hueRotate()
 * @example css({ "--ui-filter-hue-rotate": "90deg", filter: "... hue-rotate(var(--ui-filter-hue-rotate, 0deg)) ..." })
 * @example u.hueRotate("0.5turn")
 * @example css({ "--ui-filter-hue-rotate": "0.5turn", filter: "... hue-rotate(var(--ui-filter-hue-rotate, 0deg)) ..." })
 */
export function hueRotate<Node extends Element = Element>(value: AngleValue = 90) {
	return filterFunction<Node>({ hueRotate: angle(value) });
}
